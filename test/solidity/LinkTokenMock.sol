// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../contracts/oracles/RevenueOracle.sol";

contract LinkTokenMock {
    uint256 public revenue = 10000;

    /**
     * @dev transfer token to a contract address with additional data if the recipient is a contract.
     */
    function transferAndCall(
        address,
        uint256,
        bytes memory
    ) public pure returns (bool success) {
        return true;
    }

    function callback(address oracle) external {
        bytes32 requestId = keccak256(abi.encodePacked(RevenueOracle(oracle), uint256(1)));
        RevenueOracle(oracle).processResponse(requestId, revenue);
    }

    // setter for test
    function setRevenue(uint256 revenue_) external {
        revenue = revenue_;
    }
}
