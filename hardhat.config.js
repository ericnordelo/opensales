require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-web3');
require('@nomiclabs/hardhat-truffle5');
require('solidity-coverage');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');
require('hardhat-deploy');
require('./tasks/accounts');
require('./tasks/balance');
require('./tasks/upgrade');

require('dotenv').config();

const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MUMBAI_RPC_URL = process.env.MUMBAI_RPC_URL;
const INFURA_API_KEY = process.env.INFURA_API_KEY;

module.exports = {
  networks: {
    hardhat: {
      tags: ['local'],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      tags: ['local'],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
      accounts: { mnemonic: MNEMONIC },
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
      accounts: { mnemonic: MNEMONIC },
    },
    mumbai: {
      url: MUMBAI_RPC_URL,
      accounts: [PRIVATE_KEY],
      tags: ['testnet'],
    },
  },
  namedAccounts: {
    deployer: 0,
    user: 1,
  },
  gasReporter: {
    enabled: false,
  },
  mocha: {
    timeout: 999999,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: false,
            runs: 200,
          },
        },
      },
    ],
  },
};
