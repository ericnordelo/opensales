const SubscriptionReward = artifacts.require('SubscriptionReward');

const { expectRevert, constants, makeInterfaceId } = require('@openzeppelin/test-helpers');

describe('SubscriptionReward', function () {
  beforeEach(async () => {
    await deployments.fixture(['subscription_reward']);
    let deployment = await deployments.get('SubscriptionReward');

    this.subscriptionReward = await SubscriptionReward.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.subscriptionReward.address);
  });

  it('reward callable only by subscription', async () => {
    await expectRevert(
      this.subscriptionReward.reward(constants.ZERO_ADDRESS, 1),
      'Only callable by subscription contract'
    );
  });

  it('supports interface IERC165', async () => {
    let interfaceId = makeInterfaceId.ERC165(['supportsInterface(bytes4)']);
    assert.isTrue(await this.subscriptionReward.supportsInterface(interfaceId));
  });
});
