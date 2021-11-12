// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct OpenSaleProposal {
    address collection;
    uint256 tokenId;
    address paymentToken;
    uint256 price;
    address owner;
    address beneficiary;
}

struct OpenPurchaseProposal {
    address collection;
    uint256 tokenId;
    address paymentToken;
    uint256 price;
    address buyer;
    address beneficiary;
}
