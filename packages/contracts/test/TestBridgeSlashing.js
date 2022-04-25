const { expect } = require("chai");
const { defaultAbiCoder, SigningKey, hexConcat } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

const HRE_PRIVATE_KEY_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // so annoying hre doesn't give ez access
const RESOLVER_IFACE = new ethers.utils.Interface(['function resolve(bytes calldata data) external override view returns(bytes memory)']);
const L2_RESOLVER_IFACE = new ethers.utils.Interface([
  'function tsm(bytes32 chipId) returns (address)',
  'function ellipticCurve(bytes32 chipId) returns (uint8)'
]);
const MOCK_L1_RESOLVER_ADDRESS = '0xa24a1c82be280fabc73e30c80fa5b6d71c26dc35';

describe("L2Resolver bridge slashing", function () {
  let bridger, manufacturer, spanker, registry, l2Resolver;
  let chipIds, ellipticCurves, stakingExpirations, resolvers;

  beforeEach(async () => {
    [bridger, manufacturer, spanker] = await ethers.getSigners();
    // console.log('Bridger address:', bridger.address);

    // Deploy the L2 root registry and canonical resolver
    const Registry = await ethers.getContractFactory("RootRegistry");
    registry = await Registry.deploy();
    await registry.deployed();
    const L2Resolver = await ethers.getContractFactory("L2KongResolver");
    l2Resolver = await L2Resolver.deploy(bridger.address, registry.address);
    await l2Resolver.deployed();

    // Add some chips to the root registry
    const NUM_FILL = 100;
    chipIds = Array(NUM_FILL).fill().map(() => '0x' + genRanHex(64));
    ellipticCurves = Array(NUM_FILL).fill(1);
    stakingExpirations = Array(NUM_FILL).fill(1649991950);
    resolvers = Array(NUM_FILL).fill(l2Resolver.address);

    const createEntryTx = await registry.connect(manufacturer).batchMint(
      chipIds,
      ellipticCurves,
      stakingExpirations,
      resolvers
    );

    // wait until the transaction is mined
    await createEntryTx.wait();
  });

  it("Fails to spank bridger by submiting correct ellipticCurve", async function () {
    await bridger.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = L2_RESOLVER_IFACE.encodeFunctionData('ellipticCurve', [chipIds[0]]);

    // Encode the outer call to 'resolve'
    const callData = RESOLVER_IFACE.encodeFunctionData("resolve", [getterCalldata]);

    const resultData = L2_RESOLVER_IFACE.encodeFunctionResult("ellipticCurve", [1]);
    const responseHash = await l2Resolver.makeSignatureHash(MOCK_L1_RESOLVER_ADDRESS, lastBlock.timestamp, callData, resultData);
    // Sign it
    const sig = new SigningKey(HRE_PRIVATE_KEY_0).signDigest(responseHash);
    const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, lastBlock.timestamp, hexConcat([sig.r, sig._vs])]);

    const spankTx = await l2Resolver.slashBridger(MOCK_L1_RESOLVER_ADDRESS, callData, response);
    await spankTx.wait();

    // check registry hasn't lost any stake
    expect(
      ethers.utils.formatEther(await bridger.provider.getBalance(l2Resolver.address))
    ).to.equal("69.0");
  });

  it("Fails to spank bridger by submiting correct tsm which was previously set", async function () {
    await bridger.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const tsmAddress = '0x4a3434656e59a6c22c19b8609ce6f422cca312f3';
    const setTsmTx1 = await l2Resolver.setTsm(chipIds[11], tsmAddress);
    await setTsmTx1.wait();
    const setTsmTx2 = await l2Resolver.setTsm(chipIds[4], tsmAddress);
    await setTsmTx2.wait();

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = L2_RESOLVER_IFACE.encodeFunctionData('tsm', [chipIds[11]]);

    // Encode the outer call to 'resolve'
    const callData = RESOLVER_IFACE.encodeFunctionData("resolve", [getterCalldata]);

    const resultData = L2_RESOLVER_IFACE.encodeFunctionResult("tsm", [tsmAddress]);
    const responseHash = await l2Resolver.makeSignatureHash(MOCK_L1_RESOLVER_ADDRESS, lastBlock.timestamp, callData, resultData);
    // Sign it
    const sig = new SigningKey(HRE_PRIVATE_KEY_0).signDigest(responseHash);
    const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, lastBlock.timestamp, hexConcat([sig.r, sig._vs])]);

    const spankTx = await l2Resolver.slashBridger(MOCK_L1_RESOLVER_ADDRESS, callData, response);
    await spankTx.wait();

    // check registry hasn't lost any stake
    expect(
      ethers.utils.formatEther(await bridger.provider.getBalance(l2Resolver.address))
    ).to.equal("69.0");
  });

  it("Spank bridger because he messed with the TSM field", async function () {
    await bridger.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const tsmAddress = '0x4a3434656e59a6c22c19b8609ce6f422cca312f3';
    const setTsmTx1 = await l2Resolver.setTsm(chipIds[11], tsmAddress);
    await setTsmTx1.wait();
    const setTsmTx2 = await l2Resolver.setTsm(chipIds[4], tsmAddress);
    await setTsmTx2.wait();

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = L2_RESOLVER_IFACE.encodeFunctionData('tsm', [chipIds[11]]);

    // Encode the outer call to 'resolve'
    const callData = RESOLVER_IFACE.encodeFunctionData("resolve", [getterCalldata]);

    const resultData = L2_RESOLVER_IFACE.encodeFunctionResult("tsm", ["0x696934656e59a6c22c19b8609ce6f422cca312f3"]);
    const responseHash = await l2Resolver.makeSignatureHash(MOCK_L1_RESOLVER_ADDRESS, lastBlock.timestamp, callData, resultData);
    // Sign it
    const sig = new SigningKey(HRE_PRIVATE_KEY_0).signDigest(responseHash);
    const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, lastBlock.timestamp, hexConcat([sig.r, sig._vs])]);

    const spankTx = await l2Resolver.connect(spanker).slashBridger(MOCK_L1_RESOLVER_ADDRESS, callData, response);
    await expect(spankTx).to.changeEtherBalance(spanker, ethers.utils.parseEther("69.0"));
  });

  it("Spank bridger because he signed a record for a tag that doesn't exist", async function () {
    await bridger.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const tsmAddress = '0x4a3434656e59a6c22c19b8609ce6f422cca312f3';
    const setTsmTx1 = await l2Resolver.setTsm(chipIds[11], tsmAddress);
    await setTsmTx1.wait();
    const setTsmTx2 = await l2Resolver.setTsm(chipIds[4], tsmAddress);
    await setTsmTx2.wait();

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = L2_RESOLVER_IFACE.encodeFunctionData('tsm', ["0x372e8c89f78e2da7f4cc4660b7ebe3b297abbf6e4d3b6e596e549364d243f388"]);

    // Encode the outer call to 'resolve'
    const callData = RESOLVER_IFACE.encodeFunctionData("resolve", [getterCalldata]);

    const resultData = L2_RESOLVER_IFACE.encodeFunctionResult("tsm", [tsmAddress]);
    const responseHash = await l2Resolver.makeSignatureHash(MOCK_L1_RESOLVER_ADDRESS, lastBlock.timestamp, callData, resultData);
    // Sign it
    const sig = new SigningKey(HRE_PRIVATE_KEY_0).signDigest(responseHash);
    const response = defaultAbiCoder.encode(['bytes', 'uint64', 'bytes'], [resultData, lastBlock.timestamp, hexConcat([sig.r, sig._vs])]);

    const spankTx = await l2Resolver.connect(spanker).slashBridger(MOCK_L1_RESOLVER_ADDRESS, callData, response);
    await expect(spankTx).to.changeEtherBalance(spanker, ethers.utils.parseEther("69.0"));
  });

  it("Funds can be withdrawn only by bridger", async function () {
    await bridger.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("69.0") });
    await spanker.sendTransaction({ to: l2Resolver.address, value: ethers.utils.parseEther("42.0") });

    await expect(
      l2Resolver.connect(spanker).withdrawStake(42424242)
    ).to.be.reverted;

    await expect(
      await l2Resolver.connect(bridger).withdrawStake(6969696969)
    ).to.changeEtherBalance(bridger, 6969696969);
  });
});

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');