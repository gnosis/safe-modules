const BequestModule = artifacts.require("BequestModule");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(BequestModule);
  })
};
