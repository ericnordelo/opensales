const OpenSalesManager = artifacts.require('OpenSalesManager');
const CollectionMock = artifacts.require('CollectionMock');
const USDTMock = artifacts.require('USDTMock');

const { constants, expectRevert } = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');

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

    describe('using the usdt token', () => {
      beforeEach(async () => {
        let deployment = await deployments.get('USDTMock');
        this.usdt = await USDTMock.at(deployment.address);
      });

      it.only('emits SaleProposed if match not found', async () => {
        const { user } = await getNamedAccounts();

        let tx = await this.openSalesManager.approveSale(this.collection.address, 0, this.usdt.address, 1000, user, {
          from: user,
        });

        expectEvent(tx, 'SaleProposed', {
          collection: this.collection.address,
          tokenId: '0',
          paymentToken: this.usdt.address,
          price: '1000',
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
          constants.ZERO_ADDRESS
        ),
        'ERC721: owner query for nonexistent token'
      );
    });
  });
});
