//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// import "hardhat/console.sol";
import "./registryCommon.sol";

contract L2Registry {
    // TODO: move this commented stuff to second level resolver
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
    mapping(bytes32 => EntryData) private _entries;

    // bytes14 is used here to squeeze HistoricalEntry into one 32 byte word
    // This little optimization cuts gas usage in half during minting
    struct HistoricalEntry {
        uint32 timestamp;
        bytes14 chipId; // leading 14 bytes of chipid
        bytes14 entryHash; // leading 14 bytes of entryHash
    }
    HistoricalEntry[] _historicalEntries; //= new HistoricalEntry[](0);
    address _bridger;

    event EntryUpdate(uint32 timestamp, bytes32 chipId, EntryData entry);

    constructor(address bridger) {
        _bridger = bridger;
    }

    // function setBridger(address bridger) public {
    //     require(msg.sender == _bridger);
    //     _bridger = bridger;
    // }

    // TODO: determine whether we should have getEntry or copy ENS more closely by having individual getters for each field
    function getEntry(bytes32 chipId) public view returns (EntryData memory) {
        return _entries[chipId];
    }

    function batchMint(
        bytes32[] memory chipIds,
        uint8[] memory ellipticCurves,
        uint32[] memory stakingExpirations,
        address[] memory resolvers
    ) public {
        for (uint16 i = 0; i < chipIds.length; ++i) {
            EntryData memory entry = EntryData(
                ellipticCurves[i],
                stakingExpirations[i],
                resolvers[i]
            );
            _entries[chipIds[i]] = entry;
            // record the historical entries so we can threaten the bridger with a big spank
            _recordHistoricalEntry(chipIds[i], entry);
        }
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
        uint32 guaranteeTimestamp,
        bytes32 chipId,
        EntryData calldata entry, // the data the bridger alledgedly resolved
        // parameters for signature from bridger over timestamp, chipId, <entry fields>
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        // console.log("Attempting spank");
        bytes32 signatureHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encodePacked(
                        guaranteeTimestamp,
                        chipId,
                        entry.ellipticCurve,
                        entry.stakingExpiration,
                        entry.resolver
                    )
                )
            )
        );
        address signer = ecrecover(signatureHash, v, r, s);
        if (signer != _bridger) {
            // console.log("Spank invalid because ecrecover did not return bridger");
            // console.log(signer);
            // if the bridger didn't sign the message, we can't spank him
            return;
        }
        // annoying ugly for loop iteration logic because of solidity's overflow protection
        for (uint256 b = 0; b < _historicalEntries.length; ++b) {
            uint256 i = _historicalEntries.length - b - 1;
            // console.log("i", i);
            if (_historicalEntries[i].timestamp > guaranteeTimestamp) {
                // loop until we get to the entries BEFORE the guarantee timestamp
                console.log(_historicalEntries[i].timestamp);
                continue;
            }
            // go back from the guarantee time until we get to the last update to the chip in question
            if (_historicalEntries[i].chipId == bytes14(chipId)) {
                bytes32 entryHash = keccak256(
                    abi.encodePacked(
                        entry.ellipticCurve,
                        entry.stakingExpiration,
                        entry.resolver
                    )
                );
                // if the data is wrong in the slightest way we gotta spank
                if (_historicalEntries[i].entryHash != bytes14(entryHash)) {
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
        require(
            msg.sender == _bridger,
            "Only the bridger can withdraw their stake"
        );
        payable(_bridger).call{value: amount}("");
    }

    function _recordHistoricalEntry(bytes32 chipId, EntryData memory entry)
        internal
    {
        bytes32 entryHash = keccak256(
            abi.encodePacked(
                entry.ellipticCurve,
                entry.stakingExpiration,
                entry.resolver
            )
        );
        _historicalEntries.push(
            HistoricalEntry(
                uint32(block.timestamp),
                bytes14(chipId),
                bytes14(entryHash)
            )
        );
        emit EntryUpdate(uint32(block.timestamp), chipId, entry);
    }

    function getHistoricalEntries()
        public
        view
        returns (HistoricalEntry[] memory)
    {
        return _historicalEntries;
    }

    receive() external payable {}
}
