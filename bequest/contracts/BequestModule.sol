// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.5.0 <0.7.0;

import "@gnosis.pm/safe-contracts/contracts/base/Module.sol";
import "@gnosis.pm/safe-contracts/contracts/base/Module.sol";
import "@gnosis.pm/safe-contracts/contracts/base/ModuleManager.sol";
import "@gnosis.pm/safe-contracts/contracts/base/OwnerManager.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";


/// @title Bequest Module - Allows to bequest all funds on the wallet to be withdrawn after a given time.
/// @author Victor Porton - <porton@narod.ru>
/// Moreover, after the given time the heir can execute any transaction on the inherited wallet.
contract BequestModule is Module {

    string public constant NAME = "Bequest Module";
    string public constant VERSION = "0.0.1";

    event SetBequestDate(address wallet, address heir, uint time); // FIXME

    /// Who inherits control over the wallet.
    ///
    /// Safe -> heir.
    mapping(address => address) public heirs;
    /// Funds can be withdrawn after this point of time.
    ///
    /// Safe -> seconds since epoch.
    mapping(address => uint) public bequestDates;

    /// @dev Setup function sets initial storage of contract.
    /// @param _heir Who insherits control over the wallet (you can set to 0 to avoid inheriting).
    /// @param _bequestDate Funds can be withdrawn after this point of time.
    function setup(address _heir, uint _bequestDate)
        public
    {
        setManager();
        heirs[msg.sender] = _heir;
        bequestDates[msg.sender] = _bequestDate;
        if (_heir != address(0)) { // Reduce gas usage
            emit SetBequestDate(address(this), _heir, _bequestDate);
        }
    }

    /// @dev Changes bequest settings.
    /// @param _heir Who inherits control over the wallet (you can set to 0 to avoid inheriting).
    /// @param _bequestDate Funds can be withdrawn after this point of time.
    function changeHeirAndDate(address _heir, uint _bequestDate)
        public
        authorized
    {
        heirs[msg.sender] = _heir;
        bequestDates[msg.sender] = _bequestDate;
        emit SetBequestDate(address(this), _heir, _bequestDate);
    }

    // FIXME: Is `DelegateCall` a security risk?
    function execute(address to, uint256 value, bytes memory data, Enum.Operation operation)
        public
        enteredIntoInheritanceRights
    {
        require(manager.execTransactionFromModule(to, value, data, operation), "Could not execute transaction");
    }

    // FIXME: Is `DelegateCall` a security risk?
    function executeReturnData(address to, uint256 value, bytes memory data, Enum.Operation operation)
        public
        enteredIntoInheritanceRights
        returns (bytes memory returnData)
    {
        (bool success, bytes memory _returnData) = manager.execTransactionFromModuleReturnData(to, value, data, operation);
        require(success, "Could not execute transaction");
        returnData = _returnData;
    }

    modifier enteredIntoInheritanceRights() {
        require(msg.sender == heirs[msg.sender] && block.timestamp >= bequestDates[msg.sender], "No rights to take");
        _;
    }
}
