const utils = require('@gnosis.pm/safe-contracts/test/utils/general')

const truffleContract = require("@truffle/contract")

const GnosisSafeBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json")
const GnosisSafe = truffleContract(GnosisSafeBuildInfo)
GnosisSafe.setProvider(web3.currentProvider)
const GnosisSafeProxyBuildInfo = require("@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxy.json")
const GnosisSafeProxy = truffleContract(GnosisSafeProxyBuildInfo)
GnosisSafeProxy.setProvider(web3.currentProvider)

const BequestModule = artifacts.require("./BequestModule.sol")
const ERC20Wrapper = artifacts.require("./ERC20Wrapper.sol")
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

contract('BequestModule through ERC20 wrapper', function(accounts) {
    let lw
    let gnosisSafe
    let safeModule
    let token
    let wrapper

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

        token = await TestToken.new({from: accounts[0]})
        await token.transfer(gnosisSafe.address, '1000', {from: accounts[0]}) 

        wrapper = await ERC20Wrapper.new(safeModule.address, "http://example.com", {from: accounts[0]})

        let enableModuleData = await gnosisSafe.contract.methods.enableModule(safeModule.address).encodeABI()
        await execTransaction(gnosisSafe.address, 0, enableModuleData, CALL, "enable module")
        let modules = await gnosisSafe.getModules()
        assert.equal(1, modules.length)
        assert.equal(safeModule.address, modules[0])
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

    it('Execute bequest through ERC20 wrapper', async () => {
        heir = accounts[1]

        let setup = await safeModule.contract.methods.setup(heir, '1000').encodeABI()
        await execTransaction(safeModule.address, 0, setup, CALL, "setup")

        assert.equal(await safeModule.contract.methods.heir().call(), heir)
        assert.equal(await safeModule.contract.methods.bequestDate().call(), '1000')

        const big = toBN(2).pow(toBN(256)).sub(toBN(1))
        const approval2 = await token.contract.methods.approve(wrapper.address, big).encodeABI()
        await execTransaction(token.address, 0, approval2, CALL, "approval2")

        assert.equal(await token.balanceOf(lw.accounts[3]), '0')

        const Call = 0
        // const DelegateCall = 1

        let transfer = await wrapper.contract.methods.safeTransferFrom(
            gnosisSafe.address, lw.accounts[3], token.address, '10', []
        ).encodeABI()
        await await safeModule.contract.methods.execute(wrapper.address, 0, transfer, Call).send({from: heir})
        assert.equal(await token.balanceOf(lw.accounts[3]), '10')

        let transferBatch = await wrapper.contract.methods.safeBatchTransferFrom(
            gnosisSafe.address, lw.accounts[3], [token.address], ['10'], []
        ).encodeABI()
        await await safeModule.contract.methods.execute(wrapper.address, 0, transferBatch, Call).send({from: heir})
        assert.equal(await token.balanceOf(lw.accounts[3]), '20')
    })

    it('Execute bequest through ERC20 wrapper fail', async () => {
        heir = accounts[1]

        let setup = await safeModule.contract.methods.setup(heir, '1000').encodeABI()
        await execTransaction(safeModule.address, 0, setup, CALL, "setup")

        assert.equal(await safeModule.contract.methods.heir().call(), heir)
        assert.equal(await safeModule.contract.methods.bequestDate().call(), '1000')

        // We don't approve smart wallet for the wrapper.

        assert.equal(await token.balanceOf(lw.accounts[3]), '0')

        const Call = 0

        async function fail() {
            let transfer = await wrapper.contract.methods.safeTransferFrom(
                gnosisSafe.address, lw.accounts[3], token.address, '10', []
            ).encodeABI()
            await await safeModule.contract.methods.execute(wrapper.address, 0, transfer, Call).send({from: heir})
        }
        await expectThrowsAsync(fail, "Returned error: VM Exception while processing transaction: revert Could not execute transaction")
    })

    // TODO: Check the rest external functions.
})