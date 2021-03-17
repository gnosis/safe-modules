const { deployTruffleContract } = require('@gnosis.pm/singleton-deployer-truffle');
const BequestModule = artifacts.require("BequestModule");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployTruffleContract(web3, BequestModule);
  })
};
