# Bequest module

WARNING: The module was almost fully tested, but not audited. Use at your own risk.

This contract allows to bequest all funds on the wallet to be withdrawn after a given time.
Moreover, after the given time the heir can execute any transaction on the inherited wallet.

## Setting up bequests

The contract is designed as a single point registry. This way not every Safe needs to deploy their own module and it is possible that this module is shared between different Safes.

To set an bequest for a Safe it is first required that the Safe adds a **delegate**. For this a Safe transaction needs to be executed that calls `addDelegate`. This method will add the specified **delegate** for `msg.sender`, which is the Safe in case of a Safe transaction. The `addDelegate` method can be called multiple times with the same address for a **delegate** without failure.

To set a bequest need to call `setBequest` method with the heir address and the date at which the bequest becomes effective. The bequest date (the number of seconds after the epoch) and heir can be changed at any time by calling `setBequest` again. To cancel a bequest, call it with heir set to `0x0`.

After the bequest date becomes effecive, the heir account (a simple wallet or a smart contract) can call any method on the bequested wallet using `execute` or `executeReturnData` methods.

Note: It can also be used to bequest DeFi profits: The heir can withdraw not only DeFi tokens available from the bequested wallet but also the DeFi profits gained by the wallet. So, it is a good way to bequest both money and shares.

The inheritance is probably most effective if it can be used together with "money transfer from the future" system that can be used to pay science and free software salaries and other common goods, because it allows to gain some profit from a bequest before the bequest time comes:

* [https://vporton.github.io/future-salary/#/](the Future Salaries dApp) (as of 13 Jan 2021 it is a demo version - somebody please pay for audit of smart contracts to release it.)
* [https://github.com/vporton/donations](the source code of Future Salaries)

## Running tests

```bash
yarn
yarn test
```

## Compiling contracts
```bash
yarn
yarn compile
```

## Contract addresses

Contracts are from my other repo https://github.com/vporton/safe-modules/tree/bequest/bequest

### Rinkeby

`BequestModule` at `0x44a41A0C37E4869C6e23a2d4A1fAB61ed8B78e2a`

### Binance Smart Chain Test

`BequestModule` at `0x1B377121434Bc726a76bC0A4E3cDf021fDb02A0b`
