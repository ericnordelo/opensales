const OpenSalesManager = artifacts.require('OpenSalesManager');
const CollectionMock = artifacts.require('CollectionMock');
const USDTMock = artifacts.require('USDTMock');

const { constants, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { assert } = require('hardhat');

describe('OpenSalesManager', function () {
  beforeEach(async () => {
    await deployments.fixture(['open_sales', 'collection_mock', 'usdt_mock']);
    let deployment = await deployments.get('OpenSalesManager');

    this.openSalesManager = await OpenSalesManager.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.openSalesManager.address);
  });

  describe('approve sale method', () => {
    beforeEach(async () => {
      const { user } = await getNamedAccounts();

      let deployment = await deployments.get('CollectionMock');
      this.collection = await CollectionMock.at(deployment.address);

      // mint the token
      await this.collection.safeMint(user);
    });

    describe('using the payment token', () => {
      beforeEach(async () => {
        let deployment = await deployments.get('USDTMock');
        this.usdt = await USDTMock.at(deployment.address);
      });

      it('emits SaleProposed if match not found', async () => {
        const { user } = await getNamedAccounts();

        let tx = await this.openSalesManager.approveSale(
          this.collection.address,
          0,
          this.usdt.address,
          1000,
          user,
          constants.ZERO_ADDRESS,
          {
            from: user,
          }
        );

        expectEvent(tx, 'SaleProposed', {
          collection: this.collection.address,
          tokenId: '0',
          paymentToken: this.usdt.address,
          price: '1000',
        });
      });

      it('getter returns the right params after SaleProposed', async () => {
        const { user } = await getNamedAccounts();

        // create the proposal
        await this.openSalesManager.approveSale(
          this.collection.address,
          0,
          this.usdt.address,
          1000,
          user,
          constants.ZERO_ADDRESS,
          {
            from: user,
          }
        );

        // use the getter to consult
        const { proposal, id } = await this.openSalesManager.getOpenSaleProposal(
          this.collection.address,
          0,
          this.usdt.address,
          1000,
          user
        );

        let expectedId = web3.utils.keccak256(
          web3.eth.abi.encodeParameters(
            ['address', 'uint256', 'address', 'uint256', 'address'],
            [this.collection.address, 0, this.usdt.address, 1000, user]
          )
        );

        assert.strictEqual(id, expectedId, 'Invalid hash id');
        assert.strictEqual(proposal.collection, this.collection.address, 'Invalid proposal collection');
        assert.strictEqual(proposal.tokenId, '0', 'Invalid proposal token id');
        assert.strictEqual(proposal.paymentToken, this.usdt.address, 'Invalid proposal payment token');
        assert.strictEqual(proposal.price, '1000', 'Invalid proposal price');
        assert.strictEqual(proposal.owner, user, 'Invalid proposal owner');
        assert.strictEqual(proposal.beneficiary, user, 'Invalid proposal beneficiary');
      });

      it('getter reverts for unexistent proposal', async () => {
        // use the getter to consult
        await expectRevert(
          this.openSalesManager.getOpenSaleProposal(
            this.collection.address,
            0,
            this.usdt.address,
            1000,
            this.usdt.address
          ),
          'Non-existent proposal'
        );
      });

      describe('test match found', () => {
        let purchasePriceOffer = 1000;

        beforeEach(async () => {
          const { user } = await getNamedAccounts();

          // transfer the balance first
          await this.usdt.transfer(user, purchasePriceOffer);

          // create the purchase proposal
          await this.openSalesManager.approvePurchase(
            this.collection.address,
            0,
            this.usdt.address,
            purchasePriceOffer,
            user,
            constants.ZERO_ADDRESS,
            {
              from: user,
            }
          );
        });

        describe('try to sell method', () => {
          it('emits SaleCompleted if match found and allowance is enough', async () => {
            const { user, bob, alice } = await getNamedAccounts();

            // transfer the balances first
            await this.usdt.transfer(bob, purchasePriceOffer);
            await this.collection.transferFrom(user, bob, 0, { from: user });

            // set the allowances
            await this.usdt.approve(this.openSalesManager.address, purchasePriceOffer, { from: user });
            await this.collection.approve(this.openSalesManager.address, 0, { from: bob });

            // sale with greater price than the one in purchase proposal
            let tx = await this.openSalesManager.approveSale(
              this.collection.address,
              0,
              this.usdt.address,
              purchasePriceOffer,
              alice,
              user,
              {
                from: bob,
              }
            );

            // alice should have received the funds
            assert.strictEqual(
              (await this.usdt.balanceOf(alice)).toNumber(),
              purchasePriceOffer,
              'Invalid alice balance'
            );

            expectEvent.notEmitted(tx, 'SaleProposed');
            expectEvent(tx, 'SaleCompleted', {
              collection: this.collection.address,
              tokenId: '0',
              paymentToken: this.usdt.address,
              price: String(purchasePriceOffer),
            });
          });

          it('emits SaleProposed if match found and not enough allowance', async () => {
            const { user } = await getNamedAccounts();

            // sale with greater price than the one in purchase proposal
            let tx = await this.openSalesManager.approveSale(
              this.collection.address,
              0,
              this.usdt.address,
              purchasePriceOffer,
              user,
              user,
              {
                from: user,
              }
            );

            expectEvent(tx, 'SaleProposed', {
              collection: this.collection.address,
              tokenId: '0',
              paymentToken: this.usdt.address,
              price: String(purchasePriceOffer),
            });
          });
        });

        it('emits SaleProposed if match found but the amount is not enough', async () => {
          const { user } = await getNamedAccounts();

          // sale with greater price than the one in purchase proposal
          let tx = await this.openSalesManager.approveSale(
            this.collection.address,
            0,
            this.usdt.address,
            purchasePriceOffer + 100,
            user,
            user,
            {
              from: user,
            }
          );

          expectEvent(tx, 'SaleProposed', {
            collection: this.collection.address,
            tokenId: '0',
            paymentToken: this.usdt.address,
            price: String(purchasePriceOffer + 100),
          });
        });
      });
    });

    it("should't allow to approve sale without ownership", async () => {
      await expectRevert(
        this.openSalesManager.approveSale(
          this.collection.address,
          0,
          constants.ZERO_ADDRESS,
          100,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS
        ),
        'Only owner can approve'
      );
    });

    it("should't allow to approve sale from unexisting token", async () => {
      await expectRevert(
        this.openSalesManager.approveSale(
          this.collection.address,
          1,
          constants.ZERO_ADDRESS,
          100,
          constants.ZERO_ADDRESS,
          constants.ZERO_ADDRESS
        ),
        'ERC721: owner query for nonexistent token'
      );
    });
  });

  describe('approve purchase method', () => {
    beforeEach(async () => {
      const { user } = await getNamedAccounts();

      let deployment = await deployments.get('CollectionMock');
      this.collection = await CollectionMock.at(deployment.address);

      // mint the token
      await this.collection.safeMint(user);
    });

    describe('using the payment token', () => {
      beforeEach(async () => {
        let deployment = await deployments.get('USDTMock');
        this.usdt = await USDTMock.at(deployment.address);
      });

      it("should't allow to approve purchase without enough balance", async () => {
        const { user } = await getNamedAccounts();

        await expectRevert(
          this.openSalesManager.approvePurchase(
            this.collection.address,
            1,
            this.usdt.address,
            100,
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            { from: user }
          ),
          'Not enough balance'
        );
      });

      it('emits PurchaseProposed if match not found', async () => {
        const { user } = await getNamedAccounts();

        // transfer the balance first
        await this.usdt.transfer(user, 1000);

        let tx = await this.openSalesManager.approvePurchase(
          this.collection.address,
          0,
          this.usdt.address,
          1000,
          user,
          constants.ZERO_ADDRESS,
          {
            from: user,
          }
        );

        expectEvent(tx, 'PurchaseProposed', {
          collection: this.collection.address,
          tokenId: '0',
          paymentToken: this.usdt.address,
          price: '1000',
        });
      });

      it('getter returns the right params after PurchaseProposed', async () => {
        const { user } = await getNamedAccounts();

        // transfer the balance first
        await this.usdt.transfer(user, 1000);

        // create the proposal
        await this.openSalesManager.approvePurchase(
          this.collection.address,
          0,
          this.usdt.address,
          1000,
          user,
          constants.ZERO_ADDRESS,
          {
            from: user,
          }
        );

        // use the getter to consult
        const { proposal, id } = await this.openSalesManager.getOpenPurchaseProposal(
          this.collection.address,
          0,
          this.usdt.address,
          1000,
          user
        );

        let expectedId = web3.utils.keccak256(
          web3.eth.abi.encodeParameters(
            ['address', 'uint256', 'address', 'uint256', 'address'],
            [this.collection.address, 0, this.usdt.address, 1000, user]
          )
        );

        assert.strictEqual(id, expectedId, 'Invalid hash id');
        assert.strictEqual(proposal.collection, this.collection.address, 'Invalid proposal collection');
        assert.strictEqual(proposal.tokenId, '0', 'Invalid proposal token id');
        assert.strictEqual(proposal.paymentToken, this.usdt.address, 'Invalid proposal payment token');
        assert.strictEqual(proposal.price, '1000', 'Invalid proposal price');
        assert.strictEqual(proposal.buyer, user, 'Invalid proposal buyer');
        assert.strictEqual(proposal.beneficiary, user, 'Invalid proposal beneficiary');
      });

      it('getter reverts for unexistent proposal', async () => {
        // use the getter to consult
        await expectRevert(
          this.openSalesManager.getOpenPurchaseProposal(
            this.collection.address,
            0,
            this.usdt.address,
            1000,
            constants.ZERO_ADDRESS
          ),
          'Non-existent proposal'
        );
      });

      describe('test match found', () => {
        let salePriceOffer = 1000;

        beforeEach(async () => {
          const { user } = await getNamedAccounts();

          // create the sale proposal
          await this.openSalesManager.approveSale(
            this.collection.address,
            0,
            this.usdt.address,
            salePriceOffer,
            user,
            constants.ZERO_ADDRESS,
            {
              from: user,
            }
          );
        });

        describe('try to buy method', () => {
          it('emits PurchaseCompleted if match found and allowance is enough', async () => {
            const { user, bob, alice } = await getNamedAccounts();

            // transfer the balances first
            await this.usdt.transfer(bob, salePriceOffer);

            // set the allowances
            await this.usdt.approve(this.openSalesManager.address, salePriceOffer, { from: bob });
            await this.collection.approve(this.openSalesManager.address, 0, { from: user });

            let tx = await this.openSalesManager.approvePurchase(
              this.collection.address,
              0,
              this.usdt.address,
              salePriceOffer,
              alice,
              user,
              {
                from: bob,
              }
            );

            // alice should have received the token
            assert.strictEqual(await this.collection.ownerOf(0), alice, "Invalid alice's token");

            expectEvent.notEmitted(tx, 'PurchaseProposed');
            expectEvent(tx, 'PurchaseCompleted', {
              collection: this.collection.address,
              tokenId: '0',
              paymentToken: this.usdt.address,
              price: String(salePriceOffer),
            });
          });

          it('emits PurchaseProposed if match found and not enough allowance', async () => {
            const { user, bob, alice } = await getNamedAccounts();

            // transfer the balances first
            await this.usdt.transfer(bob, salePriceOffer);

            // set the allowances
            await this.usdt.approve(this.openSalesManager.address, salePriceOffer, { from: bob });

            // sale with greater price than the one in purchase proposal
            let tx = await this.openSalesManager.approvePurchase(
              this.collection.address,
              0,
              this.usdt.address,
              salePriceOffer,
              alice,
              user,
              {
                from: bob,
              }
            );

            expectEvent(tx, 'PurchaseProposed', {
              collection: this.collection.address,
              tokenId: '0',
              paymentToken: this.usdt.address,
              price: String(salePriceOffer),
            });
          });
        });

        it('emits PurchaseProposed if match found but the amount is not enough', async () => {
          const { deployer, user } = await getNamedAccounts();

          // purchase with greater price than the one in sale proposal
          let tx = await this.openSalesManager.approvePurchase(
            this.collection.address,
            0,
            this.usdt.address,
            salePriceOffer - 100,
            user,
            user,
            {
              from: deployer,
            }
          );

          expectEvent(tx, 'PurchaseProposed', {
            collection: this.collection.address,
            tokenId: '0',
            paymentToken: this.usdt.address,
            price: String(salePriceOffer - 100),
          });
        });
      });
    });
  });

  describe('cancel sale proposal method', () => {
    beforeEach(async () => {
      const { user } = await getNamedAccounts();

      let deployment = await deployments.get('CollectionMock');
      this.collection = await CollectionMock.at(deployment.address);

      deployment = await deployments.get('USDTMock');
      this.usdt = await USDTMock.at(deployment.address);

      // mint the token
      await this.collection.safeMint(user);

      await this.openSalesManager.approveSale(
        this.collection.address,
        0,
        this.usdt.address,
        1000,
        user,
        constants.ZERO_ADDRESS,
        {
          from: user,
        }
      );
    });

    it('reverts if caller is not the owner', async () => {
      const { user, bob } = await getNamedAccounts();

      let tx = this.openSalesManager.cancelSaleProposal(this.collection.address, 0, this.usdt.address, 1000, user, {
        from: bob,
      });

      await expectRevert(tx, 'Only owner can cancel');
    });

    it('emit SaleCanceled when the owner cancels', async () => {
      const { user } = await getNamedAccounts();

      let tx = await this.openSalesManager.cancelSaleProposal(
        this.collection.address,
        0,
        this.usdt.address,
        1000,
        user,
        {
          from: user,
        }
      );

      expectEvent(tx, 'SaleCanceled', {
        collection: this.collection.address,
        tokenId: '0',
        paymentToken: this.usdt.address,
      });
    });
  });

  describe('cancel purchase proposal method', () => {
    beforeEach(async () => {
      const { user } = await getNamedAccounts();

      let deployment = await deployments.get('CollectionMock');
      this.collection = await CollectionMock.at(deployment.address);

      deployment = await deployments.get('USDTMock');
      this.usdt = await USDTMock.at(deployment.address);

      // mint the token
      await this.collection.safeMint(user);

      await this.usdt.transfer(user, 1000);

      await this.openSalesManager.approvePurchase(
        this.collection.address,
        0,
        this.usdt.address,
        1000,
        user,
        constants.ZERO_ADDRESS,
        {
          from: user,
        }
      );
    });

    it('reverts if caller is not the owner', async () => {
      const { user, bob } = await getNamedAccounts();

      let tx = this.openSalesManager.cancelPurchaseProposal(this.collection.address, 0, this.usdt.address, 1000, user, {
        from: bob,
      });

      await expectRevert(tx, 'Only buyer can cancel');
    });

    it('emit PurchaseCanceled when the owner cancels', async () => {
      const { user } = await getNamedAccounts();

      let tx = await this.openSalesManager.cancelPurchaseProposal(
        this.collection.address,
        0,
        this.usdt.address,
        1000,
        user,
        {
          from: user,
        }
      );

      expectEvent(tx, 'PurchaseCanceled', {
        collection: this.collection.address,
        tokenId: '0',
        paymentToken: this.usdt.address,
      });
    });
  });

  describe('upgrade', () => {
    it("can't upgrade with wrong accounts", async () => {
      const { user } = await getNamedAccounts();

      let revertMessage = 'Ownable: caller is not the owner';
      await expectRevert(this.openSalesManager.upgradeTo(constants.ZERO_ADDRESS, { from: user }), revertMessage);
    });

    it('can upgrade with right account', async () => {
      const { deployer } = await getNamedAccounts();

      let newImplementation = await OpenSalesManager.new();

      await this.openSalesManager.upgradeTo(newImplementation.address, { from: deployer });
    });
  });
});
