// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.5.0 <0.7.0;

import "@gnosis.pm/safe-contracts/contracts/base/ModuleManager.sol";
import "@gnosis.pm/safe-contracts/contracts/base/OwnerManager.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";


/// @title Bequest Module - Allows to bequest all funds on the wallet to be withdrawn after a given time.
/// @author Victor Porton - <porton@narod.ru>
/// Moreover, after the given time the heir can execute any transaction on the inherited wallet.
contract BequestModule {

    string public constant NAME = "Bequest Module";
    string public constant VERSION = "0.0.1";

    event SetBequestDate(address safe, address heir, uint time);

    /// Who inherits control over the wallet.
    ///
    /// Safe -> heir.
    mapping(address => address) public heirs;
    /// Funds can be withdrawn after this point of time.
    ///
    /// Safe -> seconds since epoch.
    mapping(address => uint) public bequestDates;

    /// @dev Changes bequest settings.
    /// @param _heir Who inherits control over the wallet (you can set to 0 to avoid inheriting).
    /// @param _bequestDate Funds can be withdrawn after this point of time.
    /// It can be called by anybody, but the `msg.sender` can change only his own data.
    function setBequest(address _heir, uint _bequestDate)
        public
    {
        heirs[msg.sender] = _heir;
        bequestDates[msg.sender] = _bequestDate;
        emit SetBequestDate(address(this), _heir, _bequestDate);
    }

    function execute(ModuleManager safe, address to, uint256 value, bytes memory data, Enum.Operation operation)
        public
        enteredIntoInheritanceRights(safe)
    {
        require(safe.execTransactionFromModule(to, value, data, operation), "Could not execute transaction");
    }

    function executeReturnData(ModuleManager safe, address to, uint256 value, bytes memory data, Enum.Operation operation)
        public
        enteredIntoInheritanceRights(safe)
        returns (bytes memory returnData)
    {
        (bool success, bytes memory _returnData) = safe.execTransactionFromModuleReturnData(to, value, data, operation);
        require(success, "Could not execute transaction");
        returnData = _returnData;
    }

    modifier enteredIntoInheritanceRights(ModuleManager safe) {
        require(msg.sender == heirs[address(safe)] && block.timestamp >= bequestDates[address(safe)],
                "No rights to take");
        _;
    }
}
