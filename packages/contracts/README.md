# KONG fork details
This fork is based off an example that shows how to have an EIP3668 resolver that resolves from off chain data. KONG needs more than just a resolver, we need an entire registry on L2. So the fork introduces L1Registry.sol, IExtendedEntryGetter.sol, and L2Registry.sol smart contracts


- L1Registry.sol is comparable to OffChainResolver.sol in the original example and is clearly meant to be deployed on L1

- IExtendedEntryGetter.sol interface is comparable to IExtendedResolver.sol in the original example

- L2Registry is meant to be the contract that lives on Polygon/any sidechain or EVM compatible chain really. The gateway essentially "forwards" or "bridges" its state to the L1Registry using EIP3668.

# ENS Offchain Resolver Contracts

This package contains Solidity contracts you can customise and deploy to provide offchain resolution of ENS names.

These contracts implement [ENSIP 10](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution) (wildcard resolution support) and [EIP 3668](https://eips.ethereum.org/EIPS/eip-3668) (CCIP Read). Together this means that the resolver contract can be very straightforward; it simply needs to respond to all resolution requests with a redirect to your gateway, and verify gateway responses by checking the signature on the returned message.

These contracts can also be used as a starting point for other verification methods, such as allowing the owner of the name to sign the records themselves, or relying on another verification mechanism such as a merkle tree or an L2 such as Optimism. To do so, start by replacing the calls to `SignatureVerifier` in `OffchainResolver` with your own solution.

## Contracts

### [IExtendedResolver.sol](contracts/IExtendedResolver.sol)
This is the interface for wildcard resolution specified in ENSIP 10. In time this will likely be moved to the [@ensdomains/ens-contracts](https://github.com/ensdomains/ens-contracts) repository.

### [SignatureVerifier.sol](contracts/SignatureVerifier.sol)
This library facilitates checking signatures over CCIP read responses.

### [OffchainResolver.sol](contracts/OffchainResolver.sol)
This contract implements the offchain resolution system. Set this contract as the resolver for a name, and that name and all its subdomains that are not present in the ENS registry will be resolved via the provided gateway by supported clients.
