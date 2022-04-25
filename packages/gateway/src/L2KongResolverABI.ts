export default [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "bridger",
                "type": "address"
            },
            {
                "internalType": "contract IRootRegistry",
                "name": "_rootRegistry",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint64",
                "name": "timestamp",
                "type": "uint64"
            },
            {
                "indexed": false,
                "internalType": "bytes",
                "name": "getterCalldata",
                "type": "bytes"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "recordHash",
                "type": "bytes32"
            }
        ],
        "name": "RecordUpdate",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            }
        ],
        "name": "app",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            }
        ],
        "name": "ellipticCurve",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            }
        ],
        "name": "manufacturer",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            }
        ],
        "name": "resolver",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            },
            {
                "internalType": "string",
                "name": "newApp",
                "type": "string"
            }
        ],
        "name": "setApp",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "newTsm",
                "type": "address"
            }
        ],
        "name": "setTsm",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint64",
                "name": "guaranteeTimestamp",
                "type": "uint64"
            },
            {
                "internalType": "bytes",
                "name": "getterCalldata",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "packedReturnVal",
                "type": "bytes"
            },
            {
                "internalType": "uint8",
                "name": "v",
                "type": "uint8"
            },
            {
                "internalType": "bytes32",
                "name": "r",
                "type": "bytes32"
            },
            {
                "internalType": "bytes32",
                "name": "s",
                "type": "bytes32"
            }
        ],
        "name": "slashBridger",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            }
        ],
        "name": "stakingExpiration",
        "outputs": [
            {
                "internalType": "uint32",
                "name": "",
                "type": "uint32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chipId",
                "type": "bytes32"
            }
        ],
        "name": "tsm",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "withdrawStake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
];