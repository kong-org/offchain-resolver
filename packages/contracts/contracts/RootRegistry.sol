//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./IRootRegistry.sol";

// import "hardhat/console.sol";

// Intented to be deployed on L2
// Write-only root registry
// TODO: require addition of staked funds in order to add chips
contract RootRegistry is IRootRegistry {
    struct RootRecord {
        address manufacturer;
        uint8 ellipticCurve;
        uint32 stakingExpiration;
        address resolver;
    }

    mapping(bytes32 => RootRecord) private _records;

    function manufacturer(bytes32 chipId) public view returns (address) {
        return _records[chipId].manufacturer;
    }

    function ellipticCurve(bytes32 chipId) public view returns (uint8) {
        return _records[chipId].ellipticCurve;
    }

    function stakingExpiration(bytes32 chipId) public view returns (uint32) {
        return _records[chipId].stakingExpiration;
    }

    function resolver(bytes32 chipId) public view returns (address) {
        return _records[chipId].resolver;
    }

    function batchMint(
        address manufacturerAddress,
        bytes32[] memory chipIds,
        uint8[] memory ellipticCurves,
        uint32[] memory stakingExpirations,
        address[] memory resolvers
    ) public {
        for (uint16 i = 0; i < chipIds.length; ++i) {
            RootRecord memory record = RootRecord(
                manufacturerAddress,
                ellipticCurves[i],
                stakingExpirations[i],
                resolvers[i]
            );
            _records[chipIds[i]] = record;
        }
    }
}
