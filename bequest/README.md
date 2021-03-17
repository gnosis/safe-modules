# Bequest module

This contract allows to bequest all funds on the wallet to be withdrawn after a given time.
Moreover, after the given time the heir can execute any transaction on the inherited wallet.

## Setting up bequests

The contract is designed as a single point registry. This way not every Safe needs to deploy their own module and it is possible that this module is shared between different Safes.

To set an bequest for a Safe it is first required that the Safe adds a **delegate**. For this a Safe transaction needs to be executed that calls `addDelegate`. This method will add the specified **delegate** for `msg.sender`, which is the Safe in case of a Safe transaction. The `addDelegate` method can be called multiple times with the same address for a **delegate** without failure.

To set a bequest need to call `setup` method with the heir address and the date at which the bequest becomes effective. The bequest date (the number of seconds after the epoch) and heir can be changed at any time by calling `changeHeirAndDate` (with the same parameters). To cancel a bequest, call it with heir set to `0x0`.

After the bequest date becomes effecive, the heir account (a simple wallet or a smart contract) can call any method on the bequested wallet using `execute` or `executeReturnData` methods.

Another way to bequest is to use `ERC20Wrapper` or `ERC1155Wrapper` (recommended to use both) contracts that create ERC-1155 (with the bug that it does not emit events) tokens wrapping (doing the same transfers) an ERC-20 or ERC-1155 token correspondingly. To use this wrapper. The heir then (after the bequest date) can do ERC-1155 transfers (of the wrapper contract) from the bequested wallet. For this to work approve the wrapper(s) to transfer from the bequested wallet using `approve()` for ERC-20 and `setApprovalForAll()` for ERC-1155 tokens. In this scenario the heir does not gain a complete control over the bequested wallet, but only the ability to withdraw tokens from it.

Note: It can also be used to bequest DeFi profits: The heir can withdraw not only DeFi tokens available from the bequested wallet but also the DeFi profits gained by the wallet. So, it is a good way to bequest both money and shares.

The inheritance is probably most effective if it can be used together with "money transfer from the future" system that can be used to pay science and free software salaries and other common goods, because it allows to gain some profit from a bequest before the bequest time comes:

* [https://vporton.github.io/future-salary/#/](the Future Salaries dApp) (as of 13 Jan 2021 it is a demo version - somebody please pay for audit of smart contracts to release it.)
* [https://github.com/vporton/donations](the source code of Future Salaries)

TODO: Add `ERC721Wrapper`.

TODO: Contract that splits a bequest to several heirs.

## Running tests

TODO: Add tests.

```bash
yarn
yarn test
```

## Compiling contracts
```bash
yarn
yarn compile
```