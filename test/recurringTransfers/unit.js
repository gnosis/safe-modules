const utils = require('../utils')
const blockTime = require('./blockTime')
const abi = require('ethereumjs-abi')
const { wait, waitUntilBlock } = require('@digix/tempo')(web3);

const ExposedRecurringTransfersModule = artifacts.require("./test/ExposedRecurringTransfersModule.sol")
const MockContract = artifacts.require("MockContract")
const DutchExchange = artifacts.require("DutchExchange")
const DateTime = artifacts.require("DateTime")

const SECONDS_IN_DAY = 60 * 60 * 24

contract('RecurringTransfersModule', function(accounts) {
    let exposedRecurringTransfersModule
    let dutchExchangeMock
    let dutchExchange
    let currentBlockTime
    let currentDateTime

    const mockGnoAddress = '0x1'
    const mockDaiAddress = '0x2'

    beforeEach(async function() {
        // create mock DutchExchange contract
        dutchExchangeMock = await MockContract.new()
        dutchExchange = await DutchExchange.at(dutchExchangeMock.address)

        // create exposed module
        exposedRecurringTransfersModule = await ExposedRecurringTransfersModule.new()
        exposedRecurringTransfersModule.setup(dutchExchangeMock.address)

        // fast forwarding to a consistent time prevents issues
        // tests will start running at roughly 5 AM
        const currentHour = blockTime.getUtcDateTime(blockTime.getCurrentBlockTime()).hour
        await wait((23 - currentHour + 5) * 60 * 60);

        // update time
        currentBlockTime = blockTime.getCurrentBlockTime()
        currentDateTime = blockTime.getUtcDateTime(currentBlockTime)
    })

    it('is currently on day and between hours', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day, currentDateTime.hour - 1, currentDateTime.hour + 1)
        assert.isTrue(result)
    })

    it('is currently not tomorrow', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day + 1, currentDateTime.hour - 1, currentDateTime.hour + 1)
        assert.isFalse(result)
    })

    it('is currently not an hour in the future', async () => {
        const result = await exposedRecurringTransfersModule._isOnDayAndBetweenHours(currentDateTime.day, currentDateTime.hour + 1, currentDateTime.hour + 2)
        assert.isFalse(result)
    })

    it('is past month of epoch time 0', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(0)
        assert.isTrue(result)
    })

    it('is not past current month', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(currentBlockTime)
        assert.isFalse(result)
    })

    it('is past previous month', async () => {
        const result = await exposedRecurringTransfersModule._isPastMonth(currentBlockTime - (currentDateTime.day + 3) * SECONDS_IN_DAY)
        assert.isTrue(result)
    })

    it('should transfer amount properly adusted for $1000 in GNO tokens', async () => {
        // mock GNO and DAI values
        await dutchExchangeMock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockGnoAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 10e18.toFixed()]).toString('hex')
        )
        await dutchExchangeMock.givenCalldataReturn(
            await dutchExchange.contract.getPriceOfTokenInLastAuction.getData(mockDaiAddress),
            '0x' + abi.rawEncode(['uint', 'uint'], [1e18.toFixed(), 200e18.toFixed()]).toString('hex')
        )

        const result = await exposedRecurringTransfersModule._getAdjustedTransferAmount(mockGnoAddress, mockDaiAddress, 1000e18)
        assert.equal(result.toNumber(), 50e18)
    })
})