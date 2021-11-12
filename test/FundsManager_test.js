const FundsManager = artifacts.require('FundsManager');

const { constants, expectRevert } = require('@openzeppelin/test-helpers');

describe('FundsManager', function () {
  beforeEach(async () => {
    await deployments.fixture(['funds_manager']);
    let deployment = await deployments.get('FundsManager');

    this.fundsManager = await FundsManager.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.fundsManager.address);
  });

  it("can't distribute revenue directly", async () => {
    await expectRevert(
      this.fundsManager.distributeRevenue(constants.ZERO_ADDRESS, 100),
      'Only callable by the revenue oracle contract'
    );
  });
});
