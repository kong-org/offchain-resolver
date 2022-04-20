const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("L2Registry bridge slashing", function () {
  it("Batch mint 100 entries then attempt but fail to spank bridger", async function () {
    const [bridger] = await ethers.getSigners();
    // console.log('Bridger address:', bridger.address);

    const Registry = await ethers.getContractFactory("L2Registry");
    const registry = await Registry.deploy(bridger.address);
    await registry.deployed();
    await bridger.sendTransaction({ to: registry.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const NUM_FILL = 100
    const hexArray = Array(NUM_FILL).fill().map(() => '0x' + genRanHex(64));
    const ecsArray = Array(NUM_FILL).fill(1);
    const expirationArray = Array(NUM_FILL).fill(1649991950);
    const tsmArray = Array(NUM_FILL).fill("0x170d2de96366eaa2ca6e6490dc81047b1660b70a");

    const createEntryTx = await registry.batchMint(
      hexArray,
      ecsArray,
      expirationArray,
      tsmArray
    );

    // wait until the transaction is mined
    await createEntryTx.wait();

    // console.log(await registry.getHistoricalEntries());
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const payloadHash = ethers.utils.solidityKeccak256(['bytes'], [
      ethers.utils.solidityPack(
        ['uint32', 'bytes32', 'uint8', 'uint32', 'address'],
        [lastBlock.timestamp, hexArray[0], ecsArray[0], expirationArray[0], tsmArray[0]]
      )
    ]);
    // console.log('phash', payloadHash);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const entry = [ecsArray[0], expirationArray[0], tsmArray[0]];

    const spankTx = await registry.slashBridger(lastBlock.timestamp, hexArray[0], entry, v, r, s);
    await spankTx.wait();

    // check registry hasn't lost any stake
    expect(
      ethers.utils.formatEther(await bridger.provider.getBalance(registry.address))
    ).to.equal("69.0");
  });

  it("Batch mint 100 entries then spank bridger because he messed with the TSM field", async function () {
    const [bridger, spanker] = await ethers.getSigners();
    // console.log('Bridger address:', bridger.address);

    const Registry = await ethers.getContractFactory("L2Registry");
    const registry = await Registry.deploy(bridger.address);
    await registry.deployed();
    await bridger.sendTransaction({ to: registry.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const NUM_FILL = 100
    const hexArray = Array(NUM_FILL).fill().map(() => '0x' + genRanHex(64));
    const ecsArray = Array(NUM_FILL).fill(1);
    const expirationArray = Array(NUM_FILL).fill(1649991950);
    const tsmArray = Array(NUM_FILL).fill("0x170d2de96366eaa2ca6e6490dc81047b1660b70a");

    const createEntryTx = await registry.batchMint(
      hexArray,
      ecsArray,
      expirationArray,
      tsmArray
    );

    // wait until the transaction is mined
    await createEntryTx.wait();

    // console.log(await registry.getHistoricalEntries());
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const payloadHash = ethers.utils.solidityKeccak256(['bytes'], [
      ethers.utils.solidityPack(
        ['uint32', 'bytes32', 'uint8', 'uint32', 'address'],
        // try to swap tsm
        [lastBlock.timestamp, hexArray[0], ecsArray[0], expirationArray[0], "0x690d2de96366eaa2ca6e6490dc81047b1660b70a"]
      )
    ]);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const entry = [ecsArray[0], expirationArray[0], "0x690d2de96366eaa2ca6e6490dc81047b1660b70a"];

    const spankTx = await registry.connect(spanker).slashBridger(lastBlock.timestamp, hexArray[0], entry, v, r, s);
    await expect(spankTx).to.changeEtherBalance(spanker, ethers.utils.parseEther("69.0"))
  });

  it("Batch mint 100 entries then spank bridger because he signed an entry for a tag that doesn't exist", async function () {
    const [bridger] = await ethers.getSigners();
    // console.log('Bridger address:', bridger.address);

    const Registry = await ethers.getContractFactory("L2Registry");
    const registry = await Registry.deploy(bridger.address);
    await registry.deployed();
    await bridger.sendTransaction({ to: registry.address, value: ethers.utils.parseEther("69.0") }); // fund with stake

    const NUM_FILL = 100
    const hexArray = Array(NUM_FILL).fill().map(() => '0x' + genRanHex(64));
    const ecsArray = Array(NUM_FILL).fill(1);
    const expirationArray = Array(NUM_FILL).fill(1649991950);
    const tsmArray = Array(NUM_FILL).fill("0x170d2de96366eaa2ca6e6490dc81047b1660b70a");

    const createEntryTx = await registry.batchMint(
      hexArray,
      ecsArray,
      expirationArray,
      tsmArray
    );

    // wait until the transaction is mined
    await createEntryTx.wait();

    // console.log(await registry.getHistoricalEntries());
    const lastBlock = await bridger.provider.getBlock(await bridger.provider.getBlockNumber());
    const payloadHash = ethers.utils.solidityKeccak256(['bytes'], [
      ethers.utils.solidityPack(
        ['uint32', 'bytes32', 'uint8', 'uint32', 'address'],
        // try to swap tsm
        [lastBlock.timestamp, "0x372e8c89f78e2da7f4cc4660b7ebe3b297abbf6e4d3b6e596e549364d243f388",
        ecsArray[0], expirationArray[0], "0x690d2de96366eaa2ca6e6490dc81047b1660b70a"]
      )
    ]);
    const { v, r, s } = ethers.utils.splitSignature(await bridger.signMessage(ethers.utils.arrayify(payloadHash)));

    const entry = [ecsArray[0], expirationArray[0], "0x690d2de96366eaa2ca6e6490dc81047b1660b70a"];

    const spankTx = await registry.slashBridger(lastBlock.timestamp, "0x372e8c89f78e2da7f4cc4660b7ebe3b297abbf6e4d3b6e596e549364d243f388", entry, v, r, s);
    await expect(spankTx).to.changeEtherBalance(bridger, ethers.utils.parseEther("69.0"));
    // await spankTx.wait();

    // expect(await registry._hasBeenSpanked()).to.equal(true);
  });

  it("Funds can be withdrawn only by bridger", async function () {
    const [bridger, spanker] = await ethers.getSigners();
    const spankerStartBalance = await bridger.provider.getBalance(spanker.address);
    // console.log('Bridger address:', bridger.address);

    const Registry = await ethers.getContractFactory("L2Registry");
    const registry = await Registry.deploy(bridger.address);
    await registry.deployed();
    await bridger.sendTransaction({ to: registry.address, value: ethers.utils.parseEther("69.0") });
    await spanker.sendTransaction({ to: registry.address, value: ethers.utils.parseEther("42.0") });

    await expect(
      registry.connect(spanker).withdrawStake(42424242)
    ).to.be.reverted;
    await expect(
      await registry.connect(bridger).withdrawStake(6969696969)
    ).to.changeEtherBalance(bridger, 6969696969);
  });
});

const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');