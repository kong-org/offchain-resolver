const { expect } = require("chai");
const { ethers } = require("hardhat");
const { defaultAbiCoder, SigningKey, arrayify, hexConcat } = require("ethers/lib/utils");

const TEST_ADDRESS = "0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe";

describe('KongResolver', function (accounts) {
    let signer, address, resolver, snapshot, signingKey, signingAddress;

    before(async () => {
        // Set up the resolver with a bridger
        signingKey = new SigningKey(ethers.utils.randomBytes(32));
        signingAddress = ethers.utils.computeAddress(signingKey.privateKey);
        signer = await ethers.provider.getSigner();
        address = await signer.getAddress();
        const KongResolver = await ethers.getContractFactory("KongResolver");
        resolver = await KongResolver.deploy("http://localhost:8080/", signingAddress);
    });

    beforeEach(async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await ethers.provider.send("evm_revert", [snapshot]);
    })

    describe('supportsInterface()', async () => {
        it('supports known interfaces', async () => {
            // const iface = new ethers.utils.Interface(['function resolve(bytes memory data)']);
            // console.log('d',iface.getSighash('resolve'));
            expect(await resolver.supportsInterface("0xe4056186")).to.equal(true); // IExtendedResolver
        });

        it('does not support a random interface', async () => {
            expect(await resolver.supportsInterface("0x3b3b57df")).to.equal(false);
        });
    });

    describe('resolve()', async () => {
        it('returns a CCIP-read error', async () => {
            await expect(resolver.resolve('0x')).to.be.revertedWith('OffchainLookup');
        });
    });

    describe('resolveWithProof()', async () => {
        let expires, iface, callData, resultData, sig;

        before(async () => {
            expires = Math.floor(Date.now() / 1000);
            // Encode the nested call to 'addr'
            iface = new ethers.utils.Interface(["function tsm(bytes32) returns(address)"]);
            const getterCallData = iface.encodeFunctionData("tsm", ['0xd9f67dae4cf4d07d295e968b3cf3890fca48b3d40d6cc8b17db39cebd26faa3d']);

            // Encode the outer call to 'resolve'
            callData = resolver.interface.encodeFunctionData("resolve", [getterCallData]);

            // Encode the result data
            resultData = iface.encodeFunctionResult("tsm", [TEST_ADDRESS]);

            // Generate a signature hash for the response from the gateway
            const callDataHash = await resolver.makeSignatureHash(resolver.address, expires, callData, resultData);

            // Sign it
            sig = signingKey.signDigest(callDataHash);
        })

        it('resolves an address given a valid signature', async () => {
            // Generate the response data
            const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, expires, hexConcat([sig.r, sig._vs])]);

            // Call the function with the request and response
            const [result] = iface.decodeFunctionResult("tsm", await resolver.resolveWithProof(response, callData));
            expect(result).to.equal(TEST_ADDRESS);
        });

        it('reverts given an invalid signature', async () => {
            // Corrupt the sig
            const deadsig = arrayify(hexConcat([sig.r, sig._vs])).slice();
            deadsig[0] = deadsig[0] + 1;

            // Generate the response data
            const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, expires, deadsig]);

            // Call the function with the request and response
            await expect(resolver.resolveWithProof(response, callData)).to.be.reverted;
        });

        it('reverts given an expired signature', async () => {
            // Generate the response data
            const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, Math.floor(Date.now() / 1000 - 69), hexConcat([sig.r, sig._vs])]);

            // Call the function with the request and response
            await expect(resolver.resolveWithProof(response, callData)).to.be.reverted;
        });
    });
});
