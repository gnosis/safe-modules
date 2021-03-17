const chai = require('chai')

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

chai.use(require('chai-string'));

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
        chai.assert.startsWith(error.message, errorMessage)
    }
}

contract('BequestModule delegate', function(accounts) {
    let lw
    let gnosisSafe
    let safeModule
    let gnosisSafeMasterCopy

    const CALL = 0
    const ADDRESS_0 = "0x0000000000000000000000000000000000000000"

    beforeEach(async function() {
        // Create lightwallet
        lw = await utils.createLightwallet()

        // Create Master Copies
        let amodule = await BequestModule.deployed()
        console.log(amodule.address)
        safeModule = await BequestModule.new()

        gnosisSafeMasterCopy = await GnosisSafe.new({ from: accounts[0] })
        const proxy = await GnosisSafeProxy.new(gnosisSafeMasterCopy.address, { from: accounts[0] })
        gnosisSafe = await GnosisSafe.at(proxy.address)
        await gnosisSafe.setup([lw.accounts[0], lw.accounts[1], accounts[1]], 2, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0, { from: accounts[0] })

        let enableModuleData = await gnosisSafe.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe, accounts[0], gnosisSafe.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])
    })

    let execTransaction = async function(gnosisSafe, from, to, value, data, operation, message) {
        let nonce = await gnosisSafe.nonce()
        let transactionHash = await gnosisSafe.getTransactionHash(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, nonce)
        let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1]], transactionHash)
        let result = await gnosisSafe.execTransaction(to, value, data, operation, 0, 0, 0, ADDRESS_0, ADDRESS_0, sigs, { from })
        utils.logGasUsage(
            'execTransaction ' + message,
            result
        )
        return result
    }

    let execInheritanceTransaction = async function(safe, from, to, value, data, operation, message) {
        return await safeModule.contract.methods.execute(safe, to, value, data, operation).send({ from })
    }

    it('Execute bequest with delegate', async () => {
        // "Load" the safe with money:
        const token = await TestToken.new({from: accounts[0]})
        await token.transfer(gnosisSafe.address, '1000', {from: accounts[0]}) 
        
        {
            let setBequest = await safeModule.contract.methods.setBequest(accounts[1], '1000').encodeABI()
            await execTransaction(gnosisSafe, accounts[0], safeModule.address, 0, setBequest, CALL, "setup")
        }

        assert.equal(await safeModule.contract.methods.heirs(gnosisSafe.address).call(), accounts[1])
        assert.equal(await safeModule.contract.methods.bequestDates(gnosisSafe.address).call(), '1000')

        assert.equal(await token.balanceOf(lw.accounts[3]), '0')
        let transfer = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
        await execInheritanceTransaction(gnosisSafe.address, accounts[1], token.address, 0, transfer, CALL, "inheritance withdrawal")
        assert.equal(await token.balanceOf(lw.accounts[3]), '10')

        {
            async function fails() {
                let transfer = await token.contract.methods.transfer(lw.accounts[3], '10000').encodeABI()
                await execInheritanceTransaction(gnosisSafe.address, accounts[1], token.address, 0, transfer, CALL, "inheritance withdrawal") // too many tokens
            }
            await expectThrowsAsync(fails, "Transaction has been reverted by the EVM:");
        }

        {
            async function fails() {
                let transfer = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI() // wrong account
                await execInheritanceTransaction(gnosisSafe.address, accounts[2], token.address, 0, transfer, CALL, "inheritance withdrawal") // too many tokens
            }
            await expectThrowsAsync(fails, "Transaction has been reverted by the EVM:");
        }

        // Time expired:
        {
            let setBequest = await safeModule.contract.methods.setBequest(accounts[2], toBN(2).pow(toBN(64))).encodeABI()
            await execTransaction(gnosisSafe, accounts[0], safeModule.address, 0, setBequest, CALL, "setBequest")
        }
        assert.equal(await safeModule.contract.methods.heirs(gnosisSafe.address).call(), accounts[2])
        assert.equal(await safeModule.contract.methods.bequestDates(gnosisSafe.address).call(), toBN(2).pow(toBN(64)))

        {
            async function fails() {
                let transfer = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
                await execInheritanceTransaction(gnosisSafe.address, accounts[1], token.address, 0, transfer, CALL, "inheritance withdrawal") // too many tokens
            }
            await expectThrowsAsync(fails, "Transaction has been reverted by the EVM:");
        }

        // TODO: Test executeReturnData().
        // We can't test events with web3.js.
    })

    it('Try to withdraw from another safe that bequested', async () => {
        // Create the second safe"
        const proxy = await GnosisSafeProxy.new(gnosisSafeMasterCopy.address, { from: accounts[0] })
        const gnosisSafe2 = await GnosisSafe.at(proxy.address)
        await gnosisSafe2.setup([lw.accounts[0], lw.accounts[1], accounts[1]], 2, ADDRESS_0, "0x", ADDRESS_0, ADDRESS_0, 0, ADDRESS_0, { from: accounts[0] })

        // "Load" the safes with money:
        const token = await TestToken.new({from: accounts[0]})
        await token.transfer(gnosisSafe.address, '1000', {from: accounts[0]}) 
        await token.transfer(gnosisSafe2.address, '1000', {from: accounts[0]}) 
        
        let enableModuleData = await gnosisSafe2.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe2, accounts[0], gnosisSafe2.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe2.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])

        // Setup both two safes for inheritance.
        let setup = await safeModule.contract.methods.setBequest(accounts[1], '1000').encodeABI()
        await execTransaction(gnosisSafe, accounts[0], safeModule.address, 0, setup, CALL, "setup")
        let setup2 = await safeModule.contract.methods.setBequest(accounts[2], '1001').encodeABI()
        await execTransaction(gnosisSafe2, accounts[0], safeModule.address, 0, setup2, CALL, "setup")

        assert.equal(await safeModule.contract.methods.heirs(gnosisSafe.address).call(), accounts[1])
        assert.equal(await safeModule.contract.methods.bequestDates(gnosisSafe.address).call(), '1000')
        assert.equal(await safeModule.contract.methods.heirs(gnosisSafe2.address).call(), accounts[2])
        assert.equal(await safeModule.contract.methods.bequestDates(gnosisSafe2.address).call(), '1001')
  
        assert.equal(await token.balanceOf(lw.accounts[3]), '0')
        { // Take bequest.
            let transfer = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
            await execInheritanceTransaction(gnosisSafe.address, accounts[1], token.address, 0, transfer, CALL, "inheritance withdrawal")
        }
        return
        assert.equal(await token.balanceOf(lw.accounts[3]), '10')

        {
            async function fails() {
                let transfer = await token.contract.methods.transfer(lw.accounts[3], '10').encodeABI()
                await execInheritanceTransaction(gnosisSafe2.address, accounts[1], token.address, 0, transfer, CALL, "inheritance withdrawal")
            }
            await expectThrowsAsync(fails, "Transaction has been reverted by the EVM:");
        }
    })
})