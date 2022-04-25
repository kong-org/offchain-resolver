const { ethers } = require("hardhat");

module.exports = async ({ deployments }) => {
    const rootRegistryAddress = (await deployments.all()).RootRegistry.address;

    const { deploy } = deployments;
    const signers = await ethers.getSigners();
    const owner = signers[0].address;
    await deploy('L2KongResolver', {
        from: owner,
        args: [owner, rootRegistryAddress],
        log: true,
    });
};
module.exports.tags = ['test'];
