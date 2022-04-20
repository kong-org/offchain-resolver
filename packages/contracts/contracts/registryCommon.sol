//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct EntryData {
    // all fit in one 32 byte word :)
    uint8 ellipticCurve;
    uint32 stakingExpiration;
    address resolver;
}