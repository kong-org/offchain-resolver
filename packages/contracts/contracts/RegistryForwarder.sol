//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./IRootRegistry.sol";

// Intented for resolvers deployed on L2
contract RegistryForwarder {
    IRootRegistry _rootRegistry;

    constructor(IRootRegistry rootRegistry) {
        _rootRegistry = rootRegistry;
    }

    // Base resolver must "forward" each of the root registry's record fields
    function manufacturer(bytes32 chipId) public view returns (address) {
        return _rootRegistry.manufacturer(chipId);
    }

    function ellipticCurve(bytes32 chipId) public view returns (uint8) {
        return _rootRegistry.ellipticCurve(chipId);
    }

    function stakingExpiration(bytes32 chipId) public view returns (uint32) {
        return _rootRegistry.stakingExpiration(chipId);
    }

    function resolver(bytes32 chipId) public view returns (address) {
        return _rootRegistry.resolver(chipId);
    }
}
