// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Structs.sol";

/**
 * @title sales and purchase interest manager
 * @author Eric Nordelo eric.nordelo39@gmail.com
 */
contract OpenSalesManager is ReentrancyGuardUpgradeable, UUPSUpgradeable, OwnableUpgradeable {
    /// @dev the sale proposal data structures
    mapping(bytes32 => OpenSaleProposal) private _openSaleProposals;

    /// @dev the purchase proposal data structures
    mapping(bytes32 => OpenPurchaseProposal) private _openPurchaseProposals;

    /**
     * @dev emitted when a sale is completed
     * @param collection the address of the NFT collection contract
     * @param tokenId the id of the NFT
     * @param paymentToken the address of the ERC20 token used for payment
     * @param price the amount of paymentToken used for payment
     */
    event SaleCompleted(address collection, uint256 tokenId, address paymentToken, uint256 price);

    /**
     * @dev emitted when a sale is proposed
     * @param collection the address of the NFT collection contract
     * @param tokenId the id of the NFT
     * @param paymentToken the address of the ERC20 token that should be used for payment
     * @param price the amount of paymentToken that should be paid
     */
    event SaleProposed(address collection, uint256 tokenId, address paymentToken, uint256 price);

    /**
     * @dev emitted when a sale proposal is canceled
     * @param collection the address of the NFT collection contract
     * @param tokenId the id of the NFT
     * @param paymentToken the address of the ERC20 token proposed for payment
     */
    event SaleCanceled(address collection, uint256 tokenId, address paymentToken);

    /**
     * @dev emitted when a purchase is completed
     * @param collection the address of the NFT collection contract
     * @param tokenId the id of the NFT
     * @param paymentToken the address of the ERC20 token used for payment
     * @param price the amount of paymentToken used for payment
     */
    event PurchaseCompleted(address collection, uint256 tokenId, address paymentToken, uint256 price);

    /**
     * @dev emitted when a purchase is proposed
     * @param collection the address of the NFT collection contract
     * @param tokenId the id of the NFT
     * @param paymentToken the address of the ERC20 token that should be used for payment
     * @param price the amount of paymentToken that should be paid
     */
    event PurchaseProposed(address collection, uint256 tokenId, address paymentToken, uint256 price);

    /**
     * @dev emitted when a purchase proposal is canceled
     * @param collection the address of the NFT collection contract
     * @param tokenId the id of the NFT
     * @param paymentToken the address of the ERC20 token proposed for payment
     */
    event PurchaseCanceled(address collection, uint256 tokenId, address paymentToken);

    /**
     * @dev the initializer modifier is to avoid someone initializing
     *      the implementation contract after deployment
     */
    constructor() initializer {} // solhint-disable-line

    /**
     * @dev initializes the contract
     */
    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    /**
     * @notice allows to approve an intention of sale at a price
     * @dev the token will be tried to be sold in the same transaction if a matching purchase proposal is found
     * @param collection_ the address of the collection where the token belongs to
     * @param tokenId_ the id of the token to sell
     * @param paymentToken_ the address of the token to use for payment
     * @param price_ the price of the sale proposal
     * @param beneficiary_ the address receiving the payment tokens if the sale is executed
     * @param buyerToMatch_ the address to get the id for the match
     */
    function approveSale(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address beneficiary_,
        address buyerToMatch_
    ) external nonReentrant {
        // check if is the token owner
        require(IERC721(collection_).ownerOf(tokenId_) == msg.sender, "Only owner can approve");

        // not using encodePacked to avoid collisions
        bytes32 id = keccak256(abi.encode(collection_, tokenId_, paymentToken_, price_, msg.sender));

        // try to sell it in the moment if possible
        if (buyerToMatch_ != address(0)) {
            bytes32 matchId = keccak256(
                abi.encode(collection_, tokenId_, paymentToken_, price_, buyerToMatch_)
            );

            if (_openPurchaseProposals[matchId].price > 0) {
                OpenPurchaseProposal memory purchaseProposal = _openPurchaseProposals[matchId];

                // if the amount is enough
                if (purchaseProposal.price >= price_) {
                    // allowance can't be enough at this moment, or could have been canceled
                    if (_tryToSell(purchaseProposal, beneficiary_, price_)) {
                        delete _openPurchaseProposals[matchId];

                        // if there was a previous SaleProposal delete it, because the sale was already executed
                        if (_openSaleProposals[id].collection != address(0)) {
                            delete _openSaleProposals[id];
                        }

                        emit SaleCompleted(collection_, tokenId_, paymentToken_, price_);
                        return;
                    } else {
                        // the proposal has not the right allowance, so has to be removed
                        delete _openPurchaseProposals[id];
                    }
                }
            }
        }

        // if automatic sale couldn't be done
        _openSaleProposals[id] = OpenSaleProposal({
            collection: collection_,
            paymentToken: paymentToken_,
            tokenId: tokenId_,
            owner: msg.sender,
            beneficiary: beneficiary_,
            price: price_
        });

        emit SaleProposed(collection_, tokenId_, paymentToken_, price_);
    }

    /**
     * @notice allows to approve an intention of purchase at a price
     * @dev the token will be tried to be purchased in the same transaction if a matching sale proposal is found
     * @param collection_ the address of the collection where the token belongs to
     * @param tokenId_ the id of the token to sell
     * @param paymentToken_ the address of the token to use for payment
     * @param price_ the price of the sale proposal
     * @param beneficiary_ the address receiving the NFT if the purchase is executed
     * @param sellerToMatch_ the address to get the id for the match
     */
    function approvePurchase(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address beneficiary_,
        address sellerToMatch_
    ) external nonReentrant {
        require(IERC20(paymentToken_).balanceOf(msg.sender) >= price_, "Not enough balance");

        // not using encodePacked to avoid collisions
        bytes32 id = keccak256(abi.encode(collection_, tokenId_, paymentToken_, price_, msg.sender));

        require(price_ > 0, "Price can't be 0");

        // try to sell it in the moment if possible
        if (sellerToMatch_ != address(0)) {
            bytes32 matchId = keccak256(
                abi.encode(collection_, tokenId_, paymentToken_, price_, sellerToMatch_)
            );

            if (_openSaleProposals[matchId].price > 0) {
                OpenSaleProposal memory saleProposal = _openSaleProposals[matchId];

                // if the amount is enough
                if (saleProposal.price <= price_) {
                    // allowance can't be enough at this moment, or could have been canceled
                    if (_tryToBuy(saleProposal, beneficiary_, price_)) {
                        delete _openSaleProposals[matchId];

                        // if there was another PurchaseProposal keep it

                        emit PurchaseCompleted(collection_, tokenId_, paymentToken_, price_);
                        return;
                    } else {
                        // the proposal has not the right allowance, so has to be removed
                        delete _openSaleProposals[matchId];
                    }
                }
            }
        }

        // if automatic sale couldn't be done
        _openPurchaseProposals[id] = OpenPurchaseProposal({
            collection: collection_,
            paymentToken: paymentToken_,
            tokenId: tokenId_,
            buyer: msg.sender,
            beneficiary: beneficiary_,
            price: price_
        });

        emit PurchaseProposed(collection_, tokenId_, paymentToken_, price_);
    }

    /**
     * @notice allows to cancel a sale proposal
     * @param collection_ the address of the collection where the token belongs to
     * @param tokenId_ the id of the token to sell
     * @param paymentToken_ the address of the token to use for payment
     * @param price_ the price of the proposal
     * @param owner_ the owner of the token
     */
    function cancelSaleProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address owner_
    ) external {
        (OpenSaleProposal memory proposal, bytes32 id) = getOpenSaleProposal(
            collection_,
            tokenId_,
            paymentToken_,
            price_,
            owner_
        );

        require(proposal.owner == msg.sender, "Only owner can cancel");

        delete _openSaleProposals[id];

        emit SaleCanceled(collection_, tokenId_, paymentToken_);
    }

    /**
     * @notice allows to cancel a purchase proposal
     * @param collection_ the address of the collection where the token belongs to
     * @param tokenId_ the id of the token to sell
     * @param paymentToken_ the address of the token to use for payment
     * @param price_ the price of the proposal
     * @param buyer_ the buyer
     */
    function cancelPurchaseProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address buyer_
    ) external {
        (OpenPurchaseProposal memory proposal, bytes32 id) = getOpenPurchaseProposal(
            collection_,
            tokenId_,
            paymentToken_,
            price_,
            buyer_
        );

        require(proposal.buyer == msg.sender, "Only buyer can cancel");

        delete _openPurchaseProposals[id];

        emit PurchaseCanceled(collection_, tokenId_, paymentToken_);
    }

    /**
     * @notice getter to consult a sale proposal definition by id
     * @param id_ the id of the proposal (keccak256 hash of the collection, token id, and payment token)
     */
    function getOpenSaleProposalById(bytes32 id_) public view returns (OpenSaleProposal memory proposal) {
        require(_openSaleProposals[id_].price > 0, "Non-existent proposal");
        proposal = _openSaleProposals[id_];
    }

    /**
     * @notice getter to consult a sale proposal definition
     * @param collection_ the address of the collection where the token belongs to
     * @param tokenId_ the id of the token to sell
     * @param paymentToken_ the address of the token to use for payment
     * @param price_ the price of the proposal
     * @param owner_ the owner of the token
     */
    function getOpenSaleProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address owner_
    ) public view returns (OpenSaleProposal memory proposal, bytes32 id) {
        // not using encodePacked to avoid collisions
        id = keccak256(abi.encode(collection_, tokenId_, paymentToken_, price_, owner_));
        proposal = getOpenSaleProposalById(id);
    }

    /**
     * @notice getter to consult a purchase proposal definition by id
     * @param id_ the id of the proposal (keccak256 hash of the collection, token id, and payment token)
     */
    function getOpenPurchaseProposalById(bytes32 id_)
        public
        view
        returns (OpenPurchaseProposal memory proposal)
    {
        require(_openPurchaseProposals[id_].price > 0, "Non-existent proposal");
        proposal = _openPurchaseProposals[id_];
    }

    /**
     * @notice getter to consult a purchase proposal definition
     * @param collection_ the address of the collection where the token belongs to
     * @param tokenId_ the id of the token to sell
     * @param paymentToken_ the address of the token to use for payment
     * @param price_ the price of the proposal
     * @param buyer_ the buyer
     */
    function getOpenPurchaseProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address buyer_
    ) public view returns (OpenPurchaseProposal memory proposal, bytes32 id) {
        // not using encodePacked to avoid collisions
        id = keccak256(abi.encode(collection_, tokenId_, paymentToken_, price_, buyer_));
        proposal = getOpenPurchaseProposalById(id);
    }

    /**
     * @dev helper for trying to automatically sell a sale proposal
     */
    function _tryToSell(
        OpenPurchaseProposal memory purchaseProposal_,
        address moneyBeneficiary_,
        uint256 price_
    ) private returns (bool sold) {
        // try to make the transfer from the buyer
        try
            IERC20(purchaseProposal_.paymentToken).transferFrom(
                purchaseProposal_.buyer,
                moneyBeneficiary_,
                price_
            )
        returns (bool success) {
            if (!success) {
                return false;
            }
        } catch {
            return false;
        }

        // if the previous transfer was successfull transfer the NFT
        IERC721(purchaseProposal_.collection).transferFrom(
            msg.sender,
            purchaseProposal_.beneficiary,
            purchaseProposal_.tokenId
        );

        sold = true;
    }

    /**
     * @dev helper for trying to automatically buy from a purchase proposal
     */
    function _tryToBuy(
        OpenSaleProposal memory saleProposal_,
        address tokenBeneficiary_,
        uint256 price_
    ) private returns (bool bought) {
        // try to make the transfer from the seller
        try
            IERC721(saleProposal_.collection).transferFrom(
                saleProposal_.owner,
                tokenBeneficiary_,
                saleProposal_.tokenId
            )
        {
            // if the previous transfer was successfull transfer the NFT
            IERC20(saleProposal_.paymentToken).transferFrom(msg.sender, saleProposal_.beneficiary, price_);
        } catch {
            return false;
        }

        bought = true;
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address) internal view override onlyOwner {}
}
