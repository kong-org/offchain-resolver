//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./RegistryForwarder.sol";

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
        _recordHistoricalEntry(getterCalldata, keccak256(abi.encodePacked(newTsm)));
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
        _recordHistoricalEntry(getterCalldata, keccak256(abi.encodePacked(newApp)));
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
        uint64 guaranteeTimestamp,
        bytes calldata getterCalldata,
        bytes calldata packedReturnVal, // the data the bridger alledgedly resolved packed using abi.encodePacked
        // parameters for signature from bridger over timestamp, chipId, <entry fields>
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        // console.log("Attempting spank");
        bytes32 signatureHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(guaranteeTimestamp, getterCalldata, packedReturnVal))
            )
        );
        address signer = ecrecover(signatureHash, v, r, s);
        if (signer != _bridger) {
            // console.log("Spank invalid because ecrecover did not return bridger");
            // console.log(signer);
            // if the bridger didn't sign the message, we can't spank him
            return;
        }

        bytes32 recordHash = keccak256(packedReturnVal);
        bytes32 calldataHash = keccak256(getterCalldata);
        uint8 forwardedFunctionResult = _checkForwardedFunctions(getterCalldata, recordHash);
        if (forwardedFunctionResult == 1) {
            return;
        } else if (forwardedFunctionResult == 0) {
            _performSlash();
        }

        // annoying ugly for loop iteration logic because of solidity's overflow protection
        for (uint256 b = 0; b < _historicalEntries[calldataHash].length; ++b) {
            uint256 i = _historicalEntries[calldataHash].length - b - 1;
            // console.log("i", i);
            if (_historicalEntries[calldataHash][i].timestamp > guaranteeTimestamp) {
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
        _performSlash();
        return;
    }

    function _checkForwardedFunctions(bytes calldata getterCalldata, bytes32 recordHash) internal view returns (uint8) {
        bytes4 getterSelector = bytes4(getterCalldata[0:4]);
        bytes32 chipId = bytes32(getterCalldata[4:36]);

        if (getterSelector == RegistryForwarder.manufacturer.selector) {
            return keccak256(abi.encodePacked(manufacturer(chipId))) == recordHash ? 1 : 0;
        } else if (getterSelector == RegistryForwarder.ellipticCurve.selector) {
            return keccak256(abi.encodePacked(ellipticCurve(chipId))) == recordHash ? 1 : 0;
        } else if (getterSelector == RegistryForwarder.stakingExpiration.selector) {
            return keccak256(abi.encodePacked(stakingExpiration(chipId))) == recordHash ? 1 : 0;
        } else if (getterSelector == RegistryForwarder.resolver.selector) {
            return keccak256(abi.encodePacked(resolver(chipId))) == recordHash ? 1 : 0;
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
