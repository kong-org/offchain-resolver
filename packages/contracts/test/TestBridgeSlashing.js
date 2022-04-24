const { expect } = require("chai");
const { ethers } = require("hardhat");

const RESOLVER_ABI = ['function tsm(bytes32 chipId)', 'function ellipticCurve(bytes32 chipId)'];
const RESOLVER_INTERFACE = new ethers.utils.Interface(RESOLVER_ABI);

describe("L2Resolver bridge slashing", function () {
  let bridger, manufacturer, spanker, registry, resolver;
  let chipIds, ellipticCurves, stakingExpirations, resolvers;

  beforeEach(async () => {
    [bridger, manufacturer, spanker] = await ethers.getSigners();
    // console.log('Bridger address:', bridger.address);

    // Deploy the L2 root registry and canonical resolver
    const Registry = await ethers.getContractFactory("RootRegistry");
    registry = await Registry.deploy();
    await registry.deployed();
    const Resolver = await ethers.getContractFactory("L2KongResolver");
    resolver = await Resolver.deploy(bridger.address, registry.address);
    await resolver.deployed();

    // Add some chips to the root registry
    const NUM_FILL = 100;
    chipIds = Array(NUM_FILL).fill().map(() => '0x' + genRanHex(64));
    ellipticCurves = Array(NUM_FILL).fill(1);
    stakingExpirations = Array(NUM_FILL).fill(1649991950);
    resolvers = Array(NUM_FILL).fill(resolver.address);

    const createEntryTx = await registry.batchMint(
      manufacturer.address,
      chipIds,
      ellipticCurves,
      stakingExpirations,
      resolvers
    );

    // wait until the transaction is mined
    await createEntryTx.wait();
  });

  it("Fails to spank bridger by submiting correct ellipticCurve", async function () {
    await bridger.sendTransaction({ to: resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = RESOLVER_INTERFACE.encodeFunctionData('ellipticCurve', [chipIds[0]]);
    const packedReturnVal = ethers.utils.solidityPack(['uint8'], [1]);
    const payloadHash = ethers.utils.solidityKeccak256(
      ['uint32', 'bytes', 'bytes'],
      [lastBlock.timestamp, getterCalldata, packedReturnVal]
    );
    // console.log('phash', payloadHash);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const spankTx = await resolver.slashBridger(lastBlock.timestamp, getterCalldata, packedReturnVal, v, r, s);
    await spankTx.wait();

    // check registry hasn't lost any stake
    expect(
      ethers.utils.formatEther(await bridger.provider.getBalance(resolver.address))
    ).to.equal("69.0");
  });

  it("Fails to spank bridger by submiting correct tsm which was previously set", async function () {
    await bridger.sendTransaction({ to: resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const tsmAddress = '0x4a3434656e59a6c22c19b8609ce6f422cca312f3';
    const setTsmTx1 = await resolver.setTsm(chipIds[11], tsmAddress);
    await setTsmTx1.wait();
    const setTsmTx2 = await resolver.setTsm(chipIds[4], tsmAddress);
    await setTsmTx2.wait();

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = RESOLVER_INTERFACE.encodeFunctionData('tsm', [chipIds[11]]);
    const packedReturnVal = ethers.utils.solidityPack(['address'], [tsmAddress]);
    const payloadHash = ethers.utils.solidityKeccak256(
      ['uint32', 'bytes', 'bytes'],
      [lastBlock.timestamp, getterCalldata, packedReturnVal]
    );
    // console.log('phash', payloadHash);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const spankTx = await resolver.slashBridger(lastBlock.timestamp, getterCalldata, packedReturnVal, v, r, s);
    await spankTx.wait();

    // check registry hasn't lost any stake
    expect(
      ethers.utils.formatEther(await bridger.provider.getBalance(resolver.address))
    ).to.equal("69.0");
  });

  it("Spank bridger because he messed with the TSM field", async function () {
    await bridger.sendTransaction({ to: resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const tsmAddress = '0x4a3434656e59a6c22c19b8609ce6f422cca312f3';
    const setTsmTx1 = await resolver.setTsm(chipIds[11], tsmAddress);
    await setTsmTx1.wait();
    const setTsmTx2 = await resolver.setTsm(chipIds[4], tsmAddress);
    await setTsmTx2.wait();

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const getterCalldata = RESOLVER_INTERFACE.encodeFunctionData('tsm', [chipIds[11]]);
    const packedReturnVal = ethers.utils.solidityPack(['address'], ['0x696934656e59a6c22c19b8609ce6f422cca312f3']);
    const payloadHash = ethers.utils.solidityKeccak256(
      ['uint32', 'bytes', 'bytes'],
      [lastBlock.timestamp, getterCalldata, packedReturnVal]
    );
    // console.log('phash', payloadHash);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const spankTx = await resolver.connect(spanker).slashBridger(lastBlock.timestamp, getterCalldata, packedReturnVal, v, r, s);
    await expect(spankTx).to.changeEtherBalance(spanker, ethers.utils.parseEther("69.0"));
  });

  it("Spank bridger because he signed a record for a tag that doesn't exist", async function () {
    await bridger.sendTransaction({ to: resolver.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const tsmAddress = '0x4a3434656e59a6c22c19b8609ce6f422cca312f3';
    const setTsmTx1 = await resolver.setTsm(chipIds[11], tsmAddress);
    await setTsmTx1.wait();
    const setTsmTx2 = await resolver.setTsm(chipIds[4], tsmAddress);
    await setTsmTx2.wait();

    // First we mock a signature from the bridger attesting to a particular chip's ellipticCurve (expected value=1)
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    // get the tsm for a non-existent chip
    const getterCalldata = RESOLVER_INTERFACE.encodeFunctionData('tsm', ['0x372e8c89f78e2da7f4cc4660b7ebe3b297abbf6e4d3b6e596e549364d243f388']);
    const packedReturnVal = ethers.utils.solidityPack(['address'], [tsmAddress]); // correct tsm for chipsIds[11] and  chipIds[4]
    const payloadHash = ethers.utils.solidityKeccak256(
      ['uint32', 'bytes', 'bytes'],
      [lastBlock.timestamp, getterCalldata, packedReturnVal]
    );
    // console.log('phash', payloadHash);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const spankTx = await resolver.connect(spanker).slashBridger(lastBlock.timestamp, getterCalldata, packedReturnVal, v, r, s);
    await expect(spankTx).to.changeEtherBalance(spanker, ethers.utils.parseEther("69.0"));
  });

  it("Funds can be withdrawn only by bridger", async function () {
    await bridger.sendTransaction({ to: resolver.address, value: ethers.utils.parseEther("69.0") });
    await spanker.sendTransaction({ to: resolver.address, value: ethers.utils.parseEther("42.0") });

    await expect(
      resolver.connect(spanker).withdrawStake(42424242)
    ).to.be.reverted;

    await expect(
      await resolver.connect(bridger).withdrawStake(6969696969)
    ).to.changeEtherBalance(bridger, 6969696969);
  });
});

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');