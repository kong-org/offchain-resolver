//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./RegistryForwarder.sol";

// import "hardhat/console.sol";

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
        _recordHistoricalEntry(chipId, this.tsm.selector, keccak256(abi.encodePacked(newTsm)));
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
        _recordHistoricalEntry(chipId, this.app.selector, keccak256(abi.encodePacked(newApp)));
    }

    // END APP STUFF

    event RecordUpdate(uint32 timestamp, bytes32 chipId, bytes32 entryHash);

    // bytes14 is used here to squeeze HistoricalEntry into one 32 byte word
    struct HistoricalEntry {
        uint32 timestamp;
        bytes14 chipId; // leading 14 bytes of chipid
        bytes14 entryHash; // leading 14 bytes of entryHash
    }
    // map from getter selector -> historical entries array
    // E.g. tsm(bytes32 chipId) might have selector 0x69694242 which would be the key in this map
    mapping(bytes4 => HistoricalEntry[]) _historicalEntries;

    function _recordHistoricalEntry(
        bytes32 chipId,
        bytes4 getterSelector,
        bytes32 entryHash
    ) internal {
        _historicalEntries[getterSelector].push(
            HistoricalEntry(uint32(block.timestamp), bytes14(chipId), bytes14(entryHash))
        );
        emit RecordUpdate(uint32(block.timestamp), chipId, entryHash);
    }

    /* 
        To spank the bridger, one must:
        1. Have a resolution signed by the bridger. That is a timestamp guarantee G, chipId C, and entry data D
        2. Find a Historical entry with timestamp T, chipId C' and entryHash H that satisfies the following conditions:
            a. C' == C
            b. T <= G
            c. It is the entry with the highest index in _historicalEntries that satisfies conditions (a) and (b)
            d. hash(D) != H
        Alternatively,
        If there is no historical entry with C' == C but there's a valid signature from the bridger, spanking may occur
    */
    function slashBridger(
        bytes4 getterSelector,
        uint32 guaranteeTimestamp,
        bytes32 chipId,
        bytes32 entryHash, // the data the bridger alledgedly resolved
        // parameters for signature from bridger over timestamp, chipId, <entry fields>
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        // console.log("Attempting spank");
        // A hash of data that includes a hash of data that includes a hash, damn
        bytes32 signatureHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(guaranteeTimestamp, chipId, entryHash))
            )
        );
        address signer = ecrecover(signatureHash, v, r, s);
        if (signer != _bridger) {
            // console.log("Spank invalid because ecrecover did not return bridger");
            // console.log(signer);
            // if the bridger didn't sign the message, we can't spank him
            return;
        }
        if (
            getterSelector == RegistryForwarder.manufacturer.selector ||
            getterSelector == RegistryForwarder.ellipticCurve.selector ||
            getterSelector == RegistryForwarder.stakingExpiration.selector ||
            getterSelector == RegistryForwarder.resolver.selector
        ) {
            // TODO: special case because these are all immutable so no need to check records
        }

        // annoying ugly for loop iteration logic because of solidity's overflow protection
        for (uint256 b = 0; b < _historicalEntries[getterSelector].length; ++b) {
            uint256 i = _historicalEntries[getterSelector].length - b - 1;
            // console.log("i", i);
            if (_historicalEntries[getterSelector][i].timestamp > guaranteeTimestamp) {
                // loop until we get to the entries BEFORE the guarantee timestamp
                // console.log(_historicalEntries[i].timestamp);
                continue;
            }
            // go back from the guarantee time until we get to the last update to the chip in question
            if (_historicalEntries[getterSelector][i].chipId == bytes14(chipId)) {
                // if the data is wrong in the slightest way we gotta spank
                if (_historicalEntries[getterSelector][i].entryHash != bytes14(entryHash)) {
                    _performSlash();
                }
                return;
            }
        }
        // if we got to the end that means the bridger signed a message for an invalid chipId, a big nono
        _performSlash();
        return;
    }

    function _performSlash() internal {
        // TODO: spank the bridger
        // console.log("SPANK");
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
