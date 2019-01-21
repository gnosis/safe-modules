const utils = require('./utils')
const solc = require('solc')
const ABI = require('ethereumjs-abi')
const BigNumber = require('bignumber.js')
const { wait, waitUntilBlock } = require('@digix/tempo')(web3)

const GnosisSafe = artifacts.require("./GnosisSafe.sol")
const CreateAndAddModules = artifacts.require("./libraries/CreateAndAddModules.sol")
const ProxyFactory = artifacts.require("./ProxyFactory.sol")
const TransferLimitModule = artifacts.require("./modules/TransferLimitModule.sol")
const MockContract = artifacts.require('./MockContract.sol')
const TransferLimitModuleMock = artifacts.require('./mocks/TransferLimitModuleMock.sol')


const CALL = 0
let ethToWei = (new BigNumber(10)).pow(18)

contract('TransferLimitModule setup', (accounts) => {
    let lw

    beforeEach(async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()
    })

    it('should validate time period', async () => {
        assert(await reverts(setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 60 * 59, false, 0, 0, 2, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')
    })

    it('should validate threshold', async () => {
        assert(await reverts(setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 24 * 60 * 60, false, 0, 0, 0, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')

        assert(await reverts(setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 24 * 60 * 60, false, 0, 0, 3, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )), 'expected tx to revert')
    })
})

contract('TransferLimitModule authorization', (accounts) => {
    let safe
    let module
    let lw

    beforeEach(async () => {
        // Create lightwallet
        lw = await utils.createLightwallet()

        let res = await setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0], [100], 60 * 60 * 24, false, 0, 0, 2, 0, accounts[1]],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
        assert.equal(await module.manager.call(), safe.address)
        assert.equal(await web3.eth.getBalance(safe.address).toNumber(), web3.toWei(1, 'ether'))
    })

    it('should withdraw only when authorized', async () => {
        let params = [0, accounts[0], 50, 0, 0, 0, 0]
        let sigs = await signModuleTx(module, params, lw, [lw.accounts[0]])

        // Withdrawal should fail for only one signature
        await utils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[1]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(0))[1]
        assert(spent.eq(50), 'spent value should be updated')
    })

    it('should allow withdrawal for delegate', async () => {
        await updateDelegate(safe, module, lw, lw.accounts[3])
        let delegate = await module.delegate.call()
        assert.equal(delegate, lw.accounts[3])

        let params = [0, accounts[0], 50, 0, 0, 0, 0]
        let sigs = await signModuleTx(module, params, lw, [lw.accounts[3]])

        // Withdrawal should fail for only one signature by delegate
        await utils.assertRejects(
            module.executeTransferLimit(...params, sigs, { from: accounts[0] }),
            'signature threshold not met'
        )

        sigs = await signModuleTx(module, params, lw, [lw.accounts[0], lw.accounts[3]])
        // Withdraw transfer limit
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(0))[1]
        assert(spent.eq(50), 'spent value should be updated')
    })
})

contract('TransferLimitModule transfer limits', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx

    beforeEach(async () => {
        lw = await utils.createLightwallet()

        // Mock token that always transfers successfully
        token = await mockToken()

        // Mock DutchExchange
        dutchx = await mockDutchx()

        let res = await setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0, token.address], [100, 200], 60 * 60 * 24, false, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should withdraw ether within transfer limit', async () => {
        let params = [0, accounts[0], 50, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        // Withdraw transfer limit
        utils.logGasUsage(
            'executeTransferLimit withdraw transfer limit',
            await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        )
    })

    it('should not withdraw ether more than limit', async () => {
        let params = [0, accounts[0], 150, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for over withdraw'
        )
    })

    it('should withdraw token within transfer limit', async () => {
        let params = [token.address, accounts[0], 50, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let spent = (await module.transferLimits.call(token.address))[1]
        assert(spent.eq(50), 'transfer is reflected in token expenditure')
    })

    it('should not withdraw token more than limit', async () => {
        let params = [token.address, accounts[0], 250, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })

    it('should withdraw within global ether limit', async () => {
        let params = [0, accounts[0], 70, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })

        let weiSpent = (await module.transferLimits.call(0))[1]
        assert(weiSpent.eq(70), 'transfer is reflected in ether expenditure')
        let totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(70), 'total ether spent takes token transfer into account')

        params = [token.address, accounts[0], 70, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })

        let tokenSpent = (await module.transferLimits.call(token.address))[1]
        assert(tokenSpent.eq(70), 'transfer is reflected in token expenditure')
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfers')
    })

    it('should not withdraw token more than global ether limit', async () => {
        let params = [token.address, accounts[0], 70, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })

        params = [0, accounts[0], 90, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })
})

contract('TransferLimitModule global dai transfer limit', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx

    beforeEach(async () => {
        lw = await utils.createLightwallet()
        token = await mockToken()
        dutchx = await mockDutchx()
        let res = await setupModule(
            TransferLimitModuleMock,
            lw,
            accounts,
            [[0, token.address], [100, 200], 60 * 60 * 24, false, 0, 170, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]

        // Set mocked dai price
        await module.setPrice(ethToWei.toString())
    })

    it('should withdraw token within global dai limit', async () => {
        let params = [0, accounts[0], 90, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let daiSpent = await module.totalDaiSpent.call()
        assert(daiSpent.eq(90), 'dai expenditure is updated after transfer')

        params = [token.address, accounts[0], 70, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        daiSpent = await module.totalDaiSpent.call()
        assert(daiSpent.eq(160), 'dai expenditure is updated after transfer')
    })

    it('should not withdraw more than global dai limit', async () => {
        let params = [token.address, accounts[0], 180, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'tx should revert for token over withdraw'
        )
    })
})

contract('TransferLimitModule time period', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx
    const timePeriod = 60 * 60 * 24

    beforeEach(async () => {
        lw = await utils.createLightwallet()
        token = await mockToken()
        dutchx = await mockDutchx()
        let res = await setupModule(
            TransferLimitModuleMock,
            lw,
            accounts,
            [[0, token.address], [100, 200], timePeriod, false, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should reset expenditure after period is over', async () => {
        // Set "now" to 1 min after beginning of next time period.
        let now = Date.now()
        let target = (now - (now % timePeriod)) + (timePeriod + 60)
        await wait(target)

        let params = [0, accounts[0], 70, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(70), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 70, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 30, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        // Should fail as limit will be exceeded
        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'expected tx to revert when limit is exceeded'
        )

        // Fast forward one day
        await wait(timePeriod)

        params = [token.address, accounts[0], 140, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is reset and updated after one day')
    })
})

contract('TransferLimitModule rolling time period', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx
    const timePeriod = 60 * 60 * 24

    beforeEach(async () => {
        lw = await utils.createLightwallet()
        token = await mockToken()
        dutchx = await mockDutchx()
        let res = await setupModule(
            TransferLimitModuleMock,
            lw,
            accounts,
            [[0, token.address], [100, 200], 60 * 60 * 24, true, 150, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should reset expenditure after rolling period is over', async () => {
        let now = Date.now()
        let target = (now - (now % timePeriod)) + (timePeriod + 60)
        await wait(target)

        let params = [0, accounts[0], 70, 0, 0, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        let totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(70), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 70, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfer')

        // Fast forward one hour
        await wait(60 * 60)

        params = [token.address, accounts[0], 30, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        // Should fail as limit will be exceeded
        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: accounts[0] })),
            'expected tx to revert when limit is exceeded'
        )

        // Fast forward one day
        await wait(timePeriod)

        params = [token.address, accounts[0], 140, 0, 0, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)
        await module.executeTransferLimit(...params, sigs, { from: accounts[0] })
        totalWeiSpent = await module.totalWeiSpent.call()
        assert(totalWeiSpent.eq(140), 'total wei spent is updated after transfer')
    })
})

contract('TransferLimitModule gas refund', (accounts) => {
    let safe
    let module
    let lw
    let token
    let dutchx
    let relayer = accounts[1]

    beforeEach(async () => {
        lw = await utils.createLightwallet()

        // Mock token that always transfers successfully
        token = await mockToken()

        // Mock DutchExchange
        dutchx = await mockDutchx()

        let res = await setupModule(
            TransferLimitModule,
            lw,
            accounts,
            [[0, token.address], [web3.toWei('500000', 'gwei'), 200], 60 * 60 * 24, false, 0, 0, 2, 0, dutchx.address],
            [lw.accounts[0], lw.accounts[1], lw.accounts[2], accounts[0]],
            3
        )
        safe = res[0]
        module = res[1]
    })

    it('should refund relayer with ether according to gasLimit', async () => {
        // Estimate gas usage
        let gasPrice = new BigNumber(10 ** 9) // 1 Gwei
        let params = [0, accounts[2], 50, 1, gasPrice, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        let gasEstimate = await module.executeTransferLimit.estimateGas(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })

        // Calculate gasLimit based on estimate
        let gasLimit = (new BigNumber(gasEstimate)).add(5000)
        params = [0, accounts[2], 50, gasLimit, gasPrice, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)

        let balance = await web3.eth.getBalance(relayer)
        let tx = await module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice: gasPrice })
        let gasUsed = gasPrice.mul(tx.receipt.gasUsed)
        let gasRefundAmount = gasLimit.mul(gasPrice)
        let newBalance = await web3.eth.getBalance(relayer)
        assert(newBalance.eq(balance.sub(gasUsed).add(gasRefundAmount)), 'relayer should be refunded')
    })

    it('should refund relayer with token', async () => {
        let balance = await web3.eth.getBalance(relayer)
        let gasLimit = new BigNumber(10)
        let gasPrice = new BigNumber(1)
        let params = [0, accounts[2], 50, gasLimit, gasPrice, token.address, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)

        let tx = await module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })
        let gasUsed = (new BigNumber(10 ** 9)).mul(tx.receipt.gasUsed)
        let newBalance = await web3.eth.getBalance(relayer)
        assert(newBalance.eq(balance.sub(gasUsed)), 'relayer should have paid gasUsed')

        let spent = (await module.transferLimits.call(token.address))[1]
        assert(spent.eq(10), 'gas refund must be reflected in spent tokens')
    })

    it('should fail if refund exceeds transfer limits', async () => {
        let gasPrice = new BigNumber(10 ** 9) // 1 Gwei
        let params = [0, accounts[2], 50, 1, gasPrice, 0, 0]
        let signers = [lw.accounts[0], lw.accounts[1]]
        let sigs = await signModuleTx(module, params, lw, signers)
        let gasEstimate = await module.executeTransferLimit.estimateGas(...params, sigs, { from: relayer, gasPrice: 10 ** 9 })

        let gasLimit = (new BigNumber(gasEstimate)).add(5000)
        let amount = web3.toWei('400000', 'gwei')
        params = [0, accounts[2], amount, gasLimit, gasPrice, 0, 0]
        sigs = await signModuleTx(module, params, lw, signers)

        assert(
            await reverts(module.executeTransferLimit(...params, sigs, { from: relayer, gasPrice })),
            'expected tx to revert when gas refund exceeds limit'
        )
    })
})


const reverts = (p) => new Promise((resolve) => p.then(() => resolve(false)).catch((e) => resolve(e.message.search('revert') >= 0)))

const signModuleTx = async (module, params, lw, signers) => {
    let nonce = await module.nonce()
    let txHash = await module.getTransactionHash(...params, nonce)
    let sigs = utils.signTransaction(lw, signers, txHash)

    return sigs
}

const updateDelegate = async (safe, module, lw, delegate) => {
    let data = await module.contract.setDelegate.getData(delegate)

    let nonce = await safe.nonce()
    let transactionHash = await safe.getTransactionHash(module.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, nonce)
    let sigs = utils.signTransaction(lw, [lw.accounts[0], lw.accounts[1], lw.accounts[2]], transactionHash)

    await safe.execTransaction(
        module.address, 0, data, CALL, 100000, 0, web3.toWei(100, 'gwei'), 0, 0, sigs
    )
}

const mockToken = async () => {
    let token = await MockContract.new()
    await token.givenAnyReturnBool(true)
    return token
}

const mockDutchx = async () => {
    let dutchx = await MockContract.new()
    // Each token costs 1 Wei.
    await dutchx.givenMethodReturn(
        web3.sha3('getPriceOfTokenInLastAuction(address)').slice(0, 10),
        '0x' + ABI.rawEncode(['uint256', 'uint256'], [1, ethToWei.toString()]).toString('hex')
    )
    return dutchx
}

const setupModule = async (moduleContract, lw, accounts, params, safeOwners, safeThreshold) => {
    // Create Master Copies
    let proxyFactory = await ProxyFactory.new()
    let createAndAddModules = await CreateAndAddModules.new()
    let gnosisSafeMasterCopy = await GnosisSafe.new()

    let moduleMasterCopy = await moduleContract.new()
    let moduleData = await moduleMasterCopy.contract.setup.getData(...params)
    let proxyFactoryData = await proxyFactory.contract.createProxy.getData(moduleMasterCopy.address, moduleData)
    let modulesCreationData = utils.createAndAddModulesData([proxyFactoryData])
    let createAndAddModulesData = createAndAddModules.contract.createAndAddModules.getData(proxyFactory.address, modulesCreationData)
    let gnosisSafeData = await gnosisSafeMasterCopy.contract.setup.getData(safeOwners, safeThreshold, createAndAddModules.address, createAndAddModulesData)

    safe = utils.getParamFromTxEvent(
        await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData),
        'ProxyCreation', 'proxy', proxyFactory.address, GnosisSafe, 'create Gnosis Safe and Transfer Limit Module',
    )
    let modules = await safe.getModules()
    module = moduleContract.at(modules[0])

    // Deposit 1 ether
    await web3.eth.sendTransaction({ from: accounts[0], to: safe.address, value: web3.toWei(1, 'ether') })

    return [ safe, module ]
}
