// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IExtendedResolver {
    function resolve(bytes32 chipId, bytes memory data) external view returns(bytes memory);
}
