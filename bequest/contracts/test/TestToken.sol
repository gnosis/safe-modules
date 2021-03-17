// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.5.0 <0.7.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() public {
        _mint(msg.sender, 10000000);
    }
}