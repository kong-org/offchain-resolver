//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./RegistryForwarder.sol";
import "./SignatureVerifier.sol";

import "hardhat/console.sol";

contract L2KongResolver is RegistryForwarder {
    address _bridger;

    constructor(address bridger, IRootRegistry _rootRegistry) RegistryForwarder(_rootRegistry) {
        _bridger = bridger;
    }

    // function setBridger(address bridger) public {
    //     require(msg.sender == _bridger);
    //     _bridger = bridger;
    // }

    // START TSM STUFF
    mapping(bytes32 => address) _tsms;

    function tsm(bytes32 chipId) public view returns (address) {
        return _tsms[chipId];
    }

    // TODO: code permissions in here
    function setTsm(bytes32 chipId, address newTsm) public {
        _tsms[chipId] = newTsm;
        bytes memory getterCalldata = abi.encodeWithSelector(this.tsm.selector, chipId);
        _recordHistoricalEntry(getterCalldata, keccak256(abi.encode(newTsm)));
    }

    // END TSM STUFF

    // START APP STUFF
    mapping(bytes32 => string) _apps;

    function app(bytes32 chipId) public view returns (string memory) {
        return _apps[chipId];
    }

    // TODO: code permissions in here
    function setApp(bytes32 chipId, string calldata newApp) public {
        _apps[chipId] = newApp;
        bytes memory getterCalldata = abi.encodeWithSelector(this.app.selector, chipId);
        _recordHistoricalEntry(getterCalldata, keccak256(abi.encode(newApp)));
    }

    // END APP STUFF

    event RecordUpdate(uint64 timestamp, bytes getterCalldata, bytes32 recordHash);

    // bytes24 is used here to squeeze HistoricalEntry into one 32 byte word
    struct HistoricalEntry {
        uint64 timestamp;
        bytes24 recordHash; // leading 14 bytes of recordHash
    }
    // map from hash(calldata) -> historical entries array
    // E.g. tsm(bytes32 chipId) might have selector 0x69694242 which would be the key in this map
    mapping(bytes32 => HistoricalEntry[]) _historicalEntries;

    // TODO: determine whether should emit entry itself or the hash
    function _recordHistoricalEntry(bytes memory getterCalldata, bytes32 recordHash) internal {
        bytes32 calldataHash = keccak256(getterCalldata);
        _historicalEntries[calldataHash].push(HistoricalEntry(uint64(block.timestamp), bytes24(recordHash)));
        emit RecordUpdate(uint64(block.timestamp), getterCalldata, recordHash);
    }

    /* 
        To spank the bridger, one must:
        1. Have a resolution signed by the bridger. That is a timestamp guarantee G, chipId C, and entry data D
        2. Find a Historical entry with timestamp T, chipId C' and recordHash H that satisfies the following conditions:
            a. C' == C
            b. T <= G
            c. It is the entry with the highest index in _historicalEntries that satisfies conditions (a) and (b)
            d. hash(D) != H
        Alternatively,
        If there is no historical entry with C' == C but there's a valid signature from the bridger, spanking may occur
    */
    function slashBridger(
        address target,
        bytes calldata gatewayRequest,
        bytes calldata gatewayResponse //the data the bridger responded with encoded as (result, expires, signature)
    ) public {
        // console.log("Attempting spank");
        (address signer, bytes memory gatewayResult, uint64 validUntil) = SignatureVerifier.recoverSignedResponse(
            gatewayRequest,
            gatewayResponse,
            target
        );

        if (signer != _bridger) {
            // if the bridger didn't sign the message, we can't spank him
            return;
        }

        bytes memory getterCalldata = abi.decode(gatewayRequest[4:], (bytes));
        bytes32 calldataHash = keccak256(getterCalldata);
        bytes32 recordHash = keccak256(gatewayResult);

        uint8 forwardedFunctionResult = _checkForwardedFunctions(getterCalldata, recordHash);
        if (forwardedFunctionResult == 1) {
            return;
        } else if (forwardedFunctionResult == 0) {
            console.log("Forwarded");
            _performSlash();
        }

        // annoying ugly for loop iteration logic because of solidity's overflow protection
        for (uint256 b = 0; b < _historicalEntries[calldataHash].length; ++b) {
            uint256 i = _historicalEntries[calldataHash].length - b - 1;
            // console.log("i", i);
            if (_historicalEntries[calldataHash][i].timestamp > validUntil) {
                // loop until we get to the entries BEFORE the guarantee timestamp
                // console.log(_historicalEntries[i].timestamp);
                continue;
            }
            // if the data is wrong in the slightest way we gotta spank
            if (_historicalEntries[calldataHash][i].recordHash != bytes24(recordHash)) {
                _performSlash();
            }
            return;
        }
        // if we got to the end that means the bridger signed a message for an invalid chipId, a big nono
        console.log("Got to end");
        _performSlash();
        return;
    }

    // utility to help with unit testing
    function makeSignatureHash(
        address target,
        uint64 validUntil,
        bytes memory request,
        bytes memory result
    ) external pure returns (bytes32) {
        return SignatureVerifier.makeSignatureHash(target, validUntil, request, result);
    }

    function _checkForwardedFunctions(bytes memory getterCalldata, bytes32 recordHash) internal view returns (uint8) {
        bytes4 getterSelector = bytes4(getterCalldata);
        bytes memory getterArgs = new bytes(getterCalldata.length);

        for (uint256 i = 4; i < getterCalldata.length; ++i) {
            getterArgs[i - 4] = getterCalldata[i];
        }
        bytes32 chipId = abi.decode(getterArgs, (bytes32));
        // bytes4 getterSelector = bytes4(request[4:8]); // first 4 bytes are resolve() fxn selector
        // bytes32 chipId = bytes32(request[8:40]);

        if (getterSelector == RegistryForwarder.manufacturer.selector) {
            return keccak256(abi.encode(manufacturer(chipId))) == recordHash ? 1 : 0;
        } else if (getterSelector == RegistryForwarder.ellipticCurve.selector) {
            return keccak256(abi.encode(ellipticCurve(chipId))) == recordHash ? 1 : 0;
        } else if (getterSelector == RegistryForwarder.stakingExpiration.selector) {
            return keccak256(abi.encode(stakingExpiration(chipId))) == recordHash ? 1 : 0;
        } else if (getterSelector == RegistryForwarder.resolver.selector) {
            return keccak256(abi.encode(resolver(chipId))) == recordHash ? 1 : 0;
        }
        return 2;
    }

    function _performSlash() internal {
        // TODO: spank the bridger
        console.log("SPANK");
        // Send it all out to mr spanker. well played mr spanker.
        payable(msg.sender).call{value: address(this).balance}("");
    }

    function withdrawStake(uint256 amount) public {
        require(msg.sender == _bridger, "Only the bridger can withdraw their stake");
        payable(_bridger).call{value: amount}("");
    }

    receive() external payable {}
}

// struct Entry {
//     bytes32 chipId; // this can be excluded from the record if we want
//     address manufacturer;
//     address tsm;
//     address owner;
//     address contractAddress;
//     uint256 tokenId;
//     uint8 ellipticCurve; // maybe this should be called encryption type id?
//     uint8 tsmApp; // really not sure about this one's type, thinking this is the skin in the verifier?
//     uint64 currentChainId;
//     uint64[] supportedChains;
// }
