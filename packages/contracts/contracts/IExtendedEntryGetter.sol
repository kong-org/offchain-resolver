// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IExtendedEntryGetter {
    function getEntry(bytes32 chipId) external view returns(bytes memory);
}
