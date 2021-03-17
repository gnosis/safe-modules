const fs = require('fs');
const BequestModule = artifacts.require("BequestModule");
const Aggregator = artifacts.require("Aggregator");

module.exports = function(deployer, network) {
  // deployer.then(async () => {
  //   const bequestModule = await BequestModule.deployed();
  //   const addresses = JSON.parse(fs.readFileSync('node_modules/@vporton/wrap-tokens/data/addresses.json'));
  //   await deployer.deploy(Aggregator,
  //     bequestModule.address, addresses[network].ERC1155OverERC20.address, addresses[network].ERC1155OverERC721.address);
  // })
};
