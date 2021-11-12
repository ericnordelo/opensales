const Subscription = artifacts.require('Subscription');
const SubscriptionReward = artifacts.require('SubscriptionReward');
const SongsCollection = artifacts.require('SongsCollection');
const USDTMock = artifacts.require('USDTMock');
const TRAXMock = artifacts.require('TRAXMock');

const { expectRevert, expectEvent, time, constants } = require('@openzeppelin/test-helpers');

const usdt = (x) => x * 10 ** 6;

describe('Subscription', function () {
  beforeEach(async () => {
    await deployments.fixture(['subscription_reward', 'songs_collection']);
    let deployment = await deployments.get('Subscription');
    this.subscription = await Subscription.at(deployment.address);

    deployment = await deployments.get('SubscriptionReward');
    this.subscriptionReward = await SubscriptionReward.at(deployment.address);

    deployment = await deployments.get('USDTMock');
    this.usdtMock = await USDTMock.at(deployment.address);

    deployment = await deployments.get('TRAXMock');
    this.traxMock = await TRAXMock.at(deployment.address);

    deployment = await deployments.get('SongsCollection');
    this.songsCollection = await SongsCollection.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.subscription.address);
  });

  it('should have correct whatDoIGet formula', async () => {
    const { hoursOfSubscription, traxReward } = await this.subscription.whatDoIGet(usdt(5));

    expect(hoursOfSubscription.toString()).to.be.equal(time.duration.hours(20).toString());

    let _200trax = web3.utils.toWei('200');

    expect(traxReward.toString()).to.be.equal(_200trax.toString());
  });

  describe('subscription', () => {
    it('should allow to subscribe', async () => {
      const { deployer } = await getNamedAccounts();

      await this.usdtMock.approve(this.subscription.address, usdt(5));

      const { hoursOfSubscription, traxReward } = await this.subscription.whatDoIGet(usdt(5));

      let oldHours = await this.subscription.userHoursOfMusic(deployer);

      let tx = await this.subscription.subscribe(usdt(5));

      let newHours = await this.subscription.userHoursOfMusic(deployer);

      expectEvent(tx, 'Subscribed', {
        subscriber: deployer,
        hoursOfSubscription,
        traxReward,
      });

      // hours of subscription should be incremented
      assert.strictEqual(oldHours.toNumber(), newHours.sub(hoursOfSubscription).toNumber());
    });

    it('should fail to subscribe with not enough hours paid', async () => {
      await this.usdtMock.approve(this.subscription.address, usdt(1));

      await expectRevert(this.subscription.subscribe(usdt(1)), 'Should stake for more time');
    });
  });

  describe('upgrade', () => {
    it("can't upgrade with wrong accounts", async () => {
      const { user } = await getNamedAccounts();
      const UPGRADER_ROLE = web3.utils.keccak256('UPGRADER_ROLE');

      let revertMessage = `AccessControl: account ${user.toLowerCase()} is missing role ${UPGRADER_ROLE}`;
      await expectRevert(this.subscription.upgradeTo(constants.ZERO_ADDRESS, { from: user }), revertMessage);
    });
  });

  describe('SubscriptionReward integrations', () => {
    it('should mint reward token after subscription', async () => {
      const { deployer } = await getNamedAccounts();

      await this.usdtMock.approve(this.subscription.address, usdt(5));

      let tx = await this.subscription.subscribe(usdt(5));

      await expectEvent.inTransaction(tx.tx, this.subscriptionReward, 'Transfer', {
        from: constants.ZERO_ADDRESS,
        to: deployer,
        tokenId: '0',
      });
    });

    describe('claimAccruedReward', () => {
      it("can't claim wihout ownership", async () => {
        const { user } = await getNamedAccounts();

        await this.usdtMock.approve(this.subscription.address, usdt(5));

        // should mint the token
        await this.subscription.subscribe(usdt(5));

        await expectRevert(this.subscriptionReward.claimAccruedReward(0, { from: user }), 'Only owner can claim');
      });

      it('should allow to claim accrued reward', async () => {
        await this.usdtMock.approve(this.subscription.address, usdt(5));

        const { traxReward } = await this.subscription.whatDoIGet(usdt(5));

        // send funds to rewards contract
        await this.traxMock.transfer(this.subscriptionReward.address, web3.utils.toWei('1000'));

        await this.subscription.subscribe(usdt(5));

        // simulate 10 days later
        await time.increase(time.duration.days(10));

        tx = await this.subscriptionReward.claimAccruedReward(0);

        let rewardMetadata = await this.subscriptionReward.tokenMetadata(0);
        let precision = web3.utils.toBN(web3.utils.toWei('100', 'tether'));

        let accruedAmount = (await time.latest())
          .sub(rewardMetadata.timestamp)
          .mul(precision)
          .div(time.duration.days(365))
          .mul(traxReward)
          .div(precision);

        expectEvent(tx, 'AccruedRewardClaimed', {
          amount: String(accruedAmount),
          tokenId: '0',
        });

        // test claim after 1 year

        // simulate 365 days later
        await time.increase(time.duration.days(365));

        await this.subscriptionReward.claimAccruedReward(0);

        rewardMetadata = await this.subscriptionReward.tokenMetadata(0);

        // all the reward should have been claimed
        assert.strictEqual(rewardMetadata.claimedAmount.toString(), rewardMetadata.totalAmount.toString());

        tx = await this.subscriptionReward.claimAccruedReward(0);
        expectEvent.notEmitted(tx, 'AccruedRewardClaimed');
      });
    });
  });
});
