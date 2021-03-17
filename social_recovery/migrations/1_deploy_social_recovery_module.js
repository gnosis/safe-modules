const { deployTruffleContract } = require('@gnosis.pm/singleton-deployer-truffle');
const SocialRecoveryModule = artifacts.require("SocialRecoveryModule");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployTruffleContract(web3, SocialRecoveryModule);
  })
};
