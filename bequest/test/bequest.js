const utils = require('@gnosis.pm/safe-contracts/test/utils/general')

const truffleContract = require("@truffle/contract")

const GnosisSafeBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json")
const GnosisSafe = truffleContract(GnosisSafeBuildInfo)
GnosisSafe.setProvider(web3.currentProvider)
const GnosisSafeProxyBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxy.json")
const GnosisSafeProxy = truffleContract(GnosisSafeProxyBuildInfo)
GnosisSafeProxy.setProvider(web3.currentProvider)

const BequestModule = artifacts.require("./BequestModule.sol")
const TestToken = artifacts.require("./TestToken.sol")

const toBN = web3.utils.toBN

const expectThrowsAsync = async (method, errorMessage) => {
    let error = null
    try {
        await method()
    }
    catch (err) {
        error = err
    }
    expect(error).to.be.an('Error')
    if (errorMessage) {
        expect(error.message).to.equal(errorMessage)
    }
}

contract('BequestModule delegate', function(accounts) {
    let lw
    let gnosisSafe
    let safeModule

    const CALL = 0
    const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

    beforeEach(async function() {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies
        let amodule = await BequestModule.deployed()
        console.log(amodule.address)
        safeModule = await BequestModule.new()

        const gnosisSafeMasterCopy = await GnosisSafe.new({ from: accounts[0] })
        const proxy = await GnosisSafeProxy.new(gnosisSafeMasterCopy.address, { from: accounts[0] })
        gnosisSafe = await GnosisSafe.at(proxy.address)
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1], accounts[1]], 2, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0, { from: accounts[0] })
    })

    let execTransaction = async function(to, value, data, operation, message) {
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        let result = await gnosisSafe.execTransaction(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, sigs, { from: accounts[0] })
        utils.logGasUsage(
            'execTransaction ' + message,
            result
        )
        return result
    }

    it('Execute bequest with delegate', async () => {
        const token = await TestToken.new({from: accounts[0]})
        await token.transfer(gnosisSafe.address, '1000', {from: accounts[0]}) 
        
        let enableModuleData = await gnosisSafe.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])

        let setup = await safeModule.contract.methods.setup(accounts[1], '1000').encodeABI()
        await execTransaction(safeModule.address, 0, setup, CALL, "setup")

        // TODO
        // { // Can't call setup() twice
        //     async function fails() {
        //         let setup2 = await safeModule.contract.methods.setup(accounts[2], '2000').encodeABI()
        //         console.log(await execTransaction(safeModule.address, 0, setup2, CALL, "repeated setup"))
        //     }
        //     await expectThrowsAsync(fails, "Returned error: Manager has already been set");
        // }

        assert.equal(await safeModule.contract.methods.heir().call(), accounts[1])
        assert.equal(await safeModule.contract.methods.bequestDate().call(), '1000')

        const Call = 0
        // const DelegateCall = 1

        assert.equal(await token.balanceOf(lw.accounts[3]), '0')
        let transfer = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
        await await safeModule.contract.methods.execute(token.address, 0, transfer, Call).send({from: accounts[1]})
        assert.equal(await token.balanceOf(lw.accounts[3]), '10')

        {
            async function fails() {
                let transfer2 = await token.contract.methods.transfer(lw.accounts[3], '10000').encodeABI() // too many tokens
                await await safeModule.contract.methods.execute(token.address, 0, transfer2, Call).send({from: accounts[1]})
            }
            await expectThrowsAsync(fails, "Returned error: VM Exception while processing transaction: revert Could not execute transaction");
        }

        {
            async function fails() {
                let transfer2 = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
                await await safeModule.contract.methods.execute(token.address, 0, transfer2, Call).send({from: accounts[2]}) // wrong account
            }
            await expectThrowsAsync(fails, "Returned error: VM Exception while processing transaction: revert No rights to take");
        }

        // Time expired:
        let changeHeirAndDate = await safeModule.contract.methods.changeHeirAndDate(accounts[2], toBN(2).pow(toBN(64))).encodeABI()
        await execTransaction(safeModule.address, 0, changeHeirAndDate, CALL, "changeHeirAndDate")
        assert.equal(await safeModule.contract.methods.heir().call(), accounts[2])
        assert.equal(await safeModule.contract.methods.bequestDate().call(), toBN(2).pow(toBN(64)))

        {
            async function fails() {
                let transfer2 = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
                await await safeModule.contract.methods.execute(token.address, 0, transfer2, Call).send({from: accounts[2]})
            }
            await expectThrowsAsync(fails, "Returned error: VM Exception while processing transaction: revert No rights to take");
        }

        // TODO: Test executeReturnData() (requires creation of a special test contract).
    })
})