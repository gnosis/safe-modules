const HDWalletProvider = require('@truffle/hdwallet-provider')
require('dotenv').config()
const package = require('./package')
const token = process.env.INFURA_TOKEN

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.TESTNET_PRIVATE_KEY],
          providerOrUrl: "https://rinkeby.infura.io/v3/" + token
        });
      },
      network_id: '4',
      gasPrice: 25000000000, // 25 Gwei
    },
    goerli: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.TESTNET_PRIVATE_KEY],
          providerOrUrl: "https://goerli.infura.io/v3/" + token
        });
      },
      network_id: '5',
      gasPrice: 25000000000, // 25 Gwei
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.TESTNET_PRIVATE_KEY],
          providerOrUrl: "https://kovan.infura.io/v3/" + token
        });
      },
      network_id: '42',
      gasPrice: 25000000000, // 25 Gwei
    },
    mainnet: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.MAINNET_PRIVATE_KEY],
          providerOrUrl: "https://mainnet.infura.io/v3/" + token
        });
      },
      network_id: '1',
      gasPrice: 41000000000, // 41 Gwei
    },
    xdai: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.MAINNET_PRIVATE_KEY],
          providerOrUrl: "https://dai.poa.network"
        });
      },
      network_id: '100',
      gasPrice: 1000000000, // 1 Gwei
    },
    volta: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.MAINNET_PRIVATE_KEY],
          providerOrUrl: "https://volta-rpc.energyweb.org"
        });
      },
      network_id: '73799',
      gasPrice: 1
    },
    ewc: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.MAINNET_PRIVATE_KEY],
          providerOrUrl: "https://rpc.energyweb.org"
        });
      },
      network_id: '246',
      gasPrice: 1
    },
    mumbai: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.TESTNET_PRIVATE_KEY],
          providerOrUrl: "https://rpc-mumbai.maticvigil.com/v1/" + process.env.MATIC_KEY
        });
      },
      network_id: '80001',
      gasPrice: 1000000000, // 1 Gwei
    },
    bsc: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.MAINNET_PRIVATE_KEY],
          providerOrUrl: "https://bsc-dataseed1.binance.org"
        });
      },
      network_id: '56',
      gasPrice: 20000000000, // 20 Gwei
    },
    bsctest: {
      provider: function() {
        return new HDWalletProvider({
          privateKeys: [process.env.TESTNET_PRIVATE_KEY],
          providerOrUrl: "https://data-seed-prebsc-1-s1.binance.org:8545"
        });
      },
      network_id: '97',
      gasPrice: 20000000000, // 20 Gwei
    },
  },
  compilers: {
    solc: {
      version: '0.5.17',
      settings: {
        optimizer: {
          enabled: false
        }
      }
    },
  }
};
