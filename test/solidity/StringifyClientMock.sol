// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../contracts/libraries/Stringify.sol";

contract StringifyClientMock {
    using Stringify for uint256;
    using Stringify for address;
    using Stringify for string;

    function uintToString(uint256 number_) external pure returns (string memory numberAsString) {
        return number_.toString();
    }

    function addressToString(address account_) external pure returns (string memory addressAsString) {
        return account_.toString();
    }

    function stringToBytes32(string memory phrase_) external pure returns (bytes32 stringAsBytes32) {
        return phrase_.toBytes32();
    }
}
