//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IRootRegistry {
    function manufacturer(bytes32 chipId) external view returns (address);

    function ellipticCurve(bytes32 chipId) external view returns (uint8);

    function stakingExpiration(bytes32 chipId) external view returns (uint32);

    function resolver(bytes32 chipId) external view returns (address);
}
