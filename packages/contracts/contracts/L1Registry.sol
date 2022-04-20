//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./registryCommon.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/SupportsInterface.sol";

interface IEntryService {
    function getEntry(bytes calldata name, bytes calldata data)
        external
        view
        returns (EntryData memory);
}

contract L1Registry is IEntryService, SupportsInterface {
    address _bridger;
    string gatewayUrl = "https://example.kong/gateway";

    constructor(address bridger) {
        _bridger = bridger;
    }

    // function setBridger(address bridger) public {
    //     require(msg.sender == _bridger);
    //     _bridger = bridger;
    // }

    function getEntry(bytes32 chipId)
        external
        view
        override
        returns (EntryData memory)
    {
        bytes memory callData = abi.encodeWithSelector(
            IEntryService.resolve.selector,
            chipId
        );

        revert OffchainLookup(
            address(this),
            [gatewayUrl],
            callData,
            L1Registry.getEntryWithProof.selector,
            callData
        );
    }

    function getEntryWithProof(
        bytes calldata response,
        bytes calldata extraData
    ) public view returns (EntryData memory) {}

    function supportsInterface(bytes4 interfaceID)
        public
        pure
        override
        returns (bool)
    {
        return
            interfaceID == type(IExtendedEntryGetter).interfaceId ||
            super.supportsInterface(interfaceID);
    }
}
