// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Structs.sol";

contract OpenSalesManager is ReentrancyGuardUpgradeable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public constant SALE_DURATION = 1 weeks;

    /// @notice the token used for payments
    IERC20 public usdToken;

    /// @dev the sale proposal data structures
    mapping(bytes32 => OpenSaleProposal) private _openSaleProposals;

    /// @dev the purchase proposal data structures
    mapping(bytes32 => OpenPurchaseProposal) private _openPurchaseProposals;

    event SaleCompleted(address collection, uint256 tokenId, address paymentToken, uint256 price);
    event SaleProposed(address collection, uint256 tokenId, address paymentToken, uint256 price);
    event SaleCanceled(address collection, uint256 tokenId, address paymentToken);
    event PurchaseCompleted(address collection, uint256 tokenId, address paymentToken, uint256 price);
    event PurchaseProposed(address collection, uint256 tokenId, address paymentToken, uint256 price);
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

    function approveSale(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address beneficiary_
    ) external nonReentrant {
        // check if is the token owner
        require(IERC721(collection_).ownerOf(tokenId_) == msg.sender, "Only owner can approve");

        // not using encodePacked to avoid collisions
        bytes32 id = keccak256(abi.encode(collection_, tokenId_, paymentToken_));

        // try to sell it in the moment if possible
        if (_openPurchaseProposals[id].price > 0) {
            OpenPurchaseProposal memory purchaseProposal = _openPurchaseProposals[id];

            // if the amount is enough
            if (purchaseProposal.price >= price_) {
                // allowance can't be enough at this moment, or could have been canceled
                if (_tryToSell(purchaseProposal, beneficiary_, price_)) {
                    delete _openPurchaseProposals[id];

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

    function approvePurchase(
        address collection_,
        uint256 tokenId_,
        address paymentToken_,
        uint256 price_,
        address beneficiary_
    ) external nonReentrant {
        require(IERC20(paymentToken_).balanceOf(msg.sender) >= price_, "Not enough balance");

        // not using encodePacked to avoid collisions
        bytes32 id = keccak256(abi.encode(collection_, tokenId_, paymentToken_));

        // if purchase proposal exists for this token, revert if new price is smaller,
        // also avoid price to be 0
        require(price_ > _openPurchaseProposals[id].price, "New price under the current price");

        // try to sell it in the moment if possible
        if (_openSaleProposals[id].price > 0) {
            OpenSaleProposal memory saleProposal = _openSaleProposals[id];

            // if the amount is enough
            if (saleProposal.price <= price_) {
                // allowance can't be enough at this moment, or could have been canceled
                if (_tryToBuy(saleProposal, beneficiary_, price_)) {
                    delete _openSaleProposals[id];

                    // if there was another PurchaseProposal keep it

                    emit PurchaseCompleted(collection_, tokenId_, paymentToken_, price_);
                    return;
                } else {
                    // the proposal has not the right allowance, so has to be removed
                    delete _openSaleProposals[id];
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

    function cancelSaleProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_
    ) external {
        (OpenSaleProposal memory proposal, bytes32 id) = getOpenSaleProposal(
            collection_,
            tokenId_,
            paymentToken_
        );

        require(proposal.owner == msg.sender, "Only owner can cancel");

        delete _openSaleProposals[id];

        emit SaleCanceled(collection_, tokenId_, paymentToken_);
    }

    function cancelPurchaseProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_
    ) external {
        (OpenPurchaseProposal memory proposal, bytes32 id) = getOpenPurchaseProposal(
            collection_,
            tokenId_,
            paymentToken_
        );

        require(proposal.buyer == msg.sender, "Only buyer can cancel");

        delete _openPurchaseProposals[id];

        emit PurchaseCanceled(collection_, tokenId_, paymentToken_);
    }

    function getOpenSaleProposalById(bytes32 id_) public view returns (OpenSaleProposal memory proposal) {
        require(_openSaleProposals[id_].price > 0, "Unexistent proposal");
        proposal = _openSaleProposals[id_];
    }

    function getOpenSaleProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_
    ) public view returns (OpenSaleProposal memory proposal, bytes32 id) {
        // not using encodePacked to avoid collisions
        id = keccak256(abi.encode(collection_, tokenId_, paymentToken_));
        proposal = getOpenSaleProposalById(id);
    }

    function getOpenPurchaseProposalById(bytes32 id_)
        public
        view
        returns (OpenPurchaseProposal memory proposal)
    {
        require(_openPurchaseProposals[id_].price > 0, "Unexistent proposal");
        proposal = _openPurchaseProposals[id_];
    }

    function getOpenPurchaseProposal(
        address collection_,
        uint256 tokenId_,
        address paymentToken_
    ) public view returns (OpenPurchaseProposal memory proposal, bytes32 id) {
        // not using encodePacked to avoid collisions
        id = keccak256(abi.encode(collection_, tokenId_, paymentToken_));
        proposal = getOpenPurchaseProposalById(id);
    }

    // solhint-disable-next-line
    function _authorizeUpgrade(address) internal view override onlyOwner {}
}
