// // SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.5.17;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC1155 } from "./ERC1155/IERC1155.sol";
import { IERC1155MetadataURI } from "./ERC1155/IERC1155MetadataURI.sol";
// import "./IERC1155MetadataURI.sol"; // FIXME
import { Context } from "@openzeppelin/contracts/GSN/Context.sol";
import { ERC165 } from "@openzeppelin/contracts/introspection/ERC165.sol";


import { BequestModule } from "./BequestModule.sol";
import { MyOwnable } from "./MyOwnable.sol";
import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
 
/// This contract does NOT emit events.
contract ERC20Wrapper is Context, ERC165, IERC1155, IERC1155MetadataURI, MyOwnable {
    /*
     *     bytes4(keccak256('balanceOf(address,uint256)')) == 0x00fdd58e
     *     bytes4(keccak256('balanceOfBatch(address[],uint256[])')) == 0x4e1273f4
     *     bytes4(keccak256('setApprovalForAll(address,bool)')) == 0xa22cb465
     *     bytes4(keccak256('isApprovedForAll(address,address)')) == 0xe985e9c5
     *     bytes4(keccak256('safeTransferFrom(address,address,uint256,uint256,bytes)')) == 0xf242432a
     *     bytes4(keccak256('safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)')) == 0x2eb2c2d6
     *
     *     => 0x00fdd58e ^ 0x4e1273f4 ^ 0xa22cb465 ^
     *        0xe985e9c5 ^ 0xf242432a ^ 0x2eb2c2d6 == 0xd9b67a26
     */
    bytes4 private constant _INTERFACE_ID_ERC1155 = 0xd9b67a26;

    /*
     *     bytes4(keccak256('uri(uint256)')) == 0x0e89341c
     */
    bytes4 private constant _INTERFACE_ID_ERC1155_METADATA_URI = 0x0e89341c;

    BequestModule public bequest;

    constructor(address _initialOwner, BequestModule _bequest) public MyOwnable(_initialOwner) {
        // register the supported interfaces to conform to ERC1155 via ERC165
        _registerInterface(_INTERFACE_ID_ERC1155);

        // register the supported interfaces to conform to ERC1155MetadataURI via ERC165
        _registerInterface(_INTERFACE_ID_ERC1155_METADATA_URI);

        bequest = _bequest;
    }

    function _execute(address to, uint256 value, bytes memory data) internal {
        bequest.execute(to, value, data, Enum.Operation.Call);
    }

    function _executeView(address to, uint256 value, bytes memory data) internal view {
        bytes memory data2 = abi.encodeWithSelector(
            bequest.executeReturnData.selector,
            to,
            value,
            data,
            Enum.Operation.Call
        );
        address(bequest).staticcall(data2);
    }

    function _executeReturnData(address to, uint256 value, bytes memory data) internal returns (bytes memory) {
        return bequest.executeReturnData(to, value, data, Enum.Operation.Call);
    }

    function _executeReturnDataView(address to, uint256 value, bytes memory data) internal view returns (bytes memory) {
        bytes memory data2 = abi.encodeWithSelector(
            bequest.executeReturnData.selector,
            to,
            value,
            data,
            Enum.Operation.Call
        );
        (bool success, bytes memory _returnData) = address(bequest).staticcall(data2);
        require(success, "Could not execute transaction");
        return _returnData;
    }

    function balanceOf(address account, uint256 id) public view returns (uint256) {
        bytes memory data = abi.encodeWithSelector(
            IERC20(address(id)).balanceOf.selector,
            account
        );
        (uint256 result) = abi.decode(_executeReturnDataView(address(id), 0, data), (uint256));
        return result;
    }

    function balanceOfBatch(address[] memory accounts, uint256[] memory ids) public view returns (uint256[] memory balances) {
        require(accounts.length == ids.length, "Lengths don't match.");
        balances = new uint256[](accounts.length);
        for (uint i = 0; i < accounts.length; ++i) {
            balances[i] = balanceOf(accounts[i], ids[i]);
        }
    }

    function isApprovedForAll(address /*account*/, address /*operator*/) public view returns (bool) {
        return false; // FIXME
    }

    function safeBatchTransferFrom(address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory /*data*/) public onlyOwner {
        require(ids.length == amounts.length, "Lengths don't match.");
        for (uint i = 0; i < ids.length; ++i) {
            _safeTransferFrom(from, to, ids[i], amounts[i]);
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory /*data*/) public onlyOwner {
        _safeTransferFrom(from, to, id, amount);
        emit TransferSingle(msg.sender, from, to, id, amount);
    }

    function _requireSuccess(bool success) pure internal {
        require(success, "Could not execute transaction");
    }

    function _safeTransferFrom(address from, address to, uint256 id, uint256 amount) internal {
        bytes memory data = abi.encodeWithSelector(
            IERC20(address(id)).transferFrom.selector,
            from,
            to,
            amount
        );
        _execute(address(id), 0, data);
    }

    function setApprovalForAll(address /*operator*/, bool /*approved*/) public onlyOwner {
        revert("Not implemented."); // FIXME
    }

    function supportsInterface(bytes4 interfaceId) public view returns (bool) {

    }
}