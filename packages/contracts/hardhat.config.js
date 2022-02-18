const { task } = require("hardhat/config");

require("@nomiclabs/hardhat-etherscan");
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');

real_accounts = undefined;
if(process.env.DEPLOYER_KEY && process.env.OWNER_KEY) {
  real_accounts = [process.env.DEPLOYER_KEY, process.env.OWNER_KEY];
}
const gatewayurl = "https://offchain-resolver-example.uc.r.appspot.com/{sender}/{data}.json"
/**
 * @type import('hardhat/config').HardhatUserConfig
 */

// Usage: INFURA_ID=$INFURA_ID ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY npx hardhat  --network $NETWORK etherscanverify --resolver $CONTRACT_ADDRESS --signer $SIGNER_ADDRESS"
task("etherscanverify", "Verifies contracts")
  .addParam("resolver", "Resolver address")
  .addParam("signer", "Signer address")
  .setAction(async (taskArgs) => {
    await hre.run("verify:verify", {
      address: taskArgs.resolver,
      constructorArguments: [
        hre.network.config.gatewayurl,
        [taskArgs.signer],
      ],
    });
  });

module.exports = {
  solidity: "0.8.10",
  networks: {
    hardhat: {
      throwOnCallFailures: false,
      gatewayurl:'http://localhost:8080/{sender}/{data}.json',
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["test", "demo"],
      chainId: 3,
      accounts: real_accounts,
      gatewayurl,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["test", "demo"],
      chainId: 4,
      accounts: real_accounts,
      gatewayurl,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["test", "demo"],
      chainId: 5,
      accounts: real_accounts,
      gatewayurl,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["demo"],
      chainId: 1,
      accounts: real_accounts,
      gatewayurl,
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: 1,
    },
  }
};
