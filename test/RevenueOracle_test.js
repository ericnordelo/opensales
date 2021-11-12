const RevenueOracle = artifacts.require('RevenueOracle');

describe('RevenueOracle', function () {
  beforeEach(async () => {
    await deployments.fixture(['revenue_oracle']);
    let deployment = await deployments.get('RevenueOracle');

    this.oracle = await RevenueOracle.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.oracle.address);
  });
});
