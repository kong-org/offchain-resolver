/*
 This file is a result of me not having the time to learn to use ganache, mock the server, etc.
 The point of this file is to provide a jerry-rigged end-to-end test of the full registry system across L1 & L2.
 The test deploys KongResolver (deployed to L1 in prod), L2KongResolver, and RootRegistry (deployed to L2 in prod)
 to the local hardhat network and attemps to resolve some data using EIP3668 and the latest version of ethers (ccip-read compatible).

 NOTE: The gateway server AND hardhat node must be started seperately in other processes for these tests to succeed
*/

const { expect } = require("chai");
const { ethers, Signer, Wallet } = require("ethers"); // NOTE: this is "real" ethers not hardhat ethers
const { defaultAbiCoder, SigningKey, arrayify, hexConcat } = require("ethers/lib/utils");
const { abi: RootRegistryABI } = require('../artifacts/contracts/RootRegistry.sol/RootRegistry.json');
const { abi: KongResolverABI } = require('../artifacts/contracts/KongResolver.sol/KongResolver.json');
const { abi: L2KongResolverABI } = require('../artifacts/contracts/L2KongResolver.sol/L2KongResolver.json');
const axios = require('axios');

const KONG_RESOLVER_ADDRESS = "0x8464135c8F25Da09e49BC8782676a84730C318bC";
const L2_KONG_RESOLVER_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const ROOT_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const HRE_PRIVATE_KEY_1 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

describe('E2E System', function (accounts) {
    let localProvider, resolver, l2Resolver, rootRegistry;
    let chipIds, ellipticCurves, stakingExpirations, resolvers;
    let hreWallet1;

    before(async () => {
        localProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        hreWallet1 = new ethers.Wallet(new SigningKey(HRE_PRIVATE_KEY_1)).connect(localProvider);
        // don't connect signer unless we need it
        rootRegistry = new ethers.Contract(ROOT_REGISTRY_ADDRESS, RootRegistryABI, localProvider);
        l2Resolver = new ethers.Contract(L2_KONG_RESOLVER_ADDRESS, L2KongResolverABI, localProvider);
        resolver = new ethers.Contract(KONG_RESOLVER_ADDRESS, KongResolverABI, localProvider);

        const NUM_FILL = 100;
        chipIds = Array(NUM_FILL).fill().map(() => '0x' + genRanHex(64));
        ellipticCurves = Array(NUM_FILL).fill(1);
        stakingExpirations = Array(NUM_FILL).fill(1649991950);
        resolvers = Array(NUM_FILL).fill(l2Resolver.address);

        const createEntryTx = await rootRegistry.connect(hreWallet1).batchMint(
            chipIds,
            ellipticCurves,
            stakingExpirations,
            resolvers
        );

        // wait until the transaction is mined
        await createEntryTx.wait();
    });

    it('resolvesWithProof and interfaces with the server', async () => {
        // Encode the nested call to 'addr'
        const iface = new ethers.utils.Interface(["function manufacturer(bytes32) returns(address)"]);
        const getterCallData = iface.encodeFunctionData("manufacturer", [chipIds[0]]);

        // Perform a CCIP-read
        // await resolver.resolve(getterCallData);
        const rawResult = await resolver.resolve(getterCallData, { ccipReadEnabled: true });
        const [result] = iface.decodeFunctionResult("manufacturer", rawResult);

        expect(result).to.equal(hreWallet1.address);
    });

    it('interfaces with the server and attempts to slash but fails', async () => {
        await hreWallet1.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

        // Encode the nested call to 'addr'
        const iface = new ethers.utils.Interface(["function manufacturer(bytes32) returns(address)"]);
        const getterCallData = iface.encodeFunctionData("manufacturer", [chipIds[0]]);

        // Encode the outer call to 'resolve'
        const callData = resolver.interface.encodeFunctionData("resolve", [getterCallData]);

        // Perform a CCIP-read
        let eip3668data;
        try {
            await resolver.resolve(getterCallData);
        } catch (error) {
            eip3668data = error.errorArgs;
        }
        const callUrl = eip3668data.urls[0].replace('{sender}', eip3668data.sender).replace('{data}', eip3668data.callData);
        const { data: { data: response } } = await axios.get(callUrl);

        const slashTx = await l2Resolver.connect(hreWallet1).slashBridger(resolver.address, callData, response);
        await expect(slashTx).to.changeEtherBalance(hreWallet1, ethers.utils.parseEther("0.0"));
    });
});

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');