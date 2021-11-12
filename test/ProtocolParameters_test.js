const ProtocolParameters = artifacts.require('ProtocolParameters');

const { expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

describe('ProtocolParameters', function () {
  beforeEach(async () => {
    await deployments.fixture(['protocol_parameters']);
    let deployment = await deployments.get('ProtocolParameters');

    this.protocolParameters = await ProtocolParameters.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.protocolParameters.address);
  });

  it('has the right default values after deployment', async () => {
    let artistPercent = await this.protocolParameters.artistSongRevenuePercent();
    let minTimeOfSubscription = await this.protocolParameters.minTimeOfSubscription();

    expect(artistPercent.toNumber()).to.be.equal(2121);
    expect(minTimeOfSubscription.toNumber()).to.be.equal(time.duration.hours(5).toNumber());
  });

  it('allows to update artistSongRevenuePercent', async () => {
    let tx = await this.protocolParameters.setArtistSongRevenuePercent(2525);

    expectEvent(tx, 'ArtistSongRevenuePercentUpdated', { from: '2121', to: '2525' });

    let artistPercent = await this.protocolParameters.artistSongRevenuePercent();

    expect(artistPercent.toNumber()).to.be.equal(2525);
  });

  it('fails to update artistSongRevenuePercent with non governance account', async () => {
    const { user } = await getNamedAccounts();

    let tx = this.protocolParameters.setArtistSongRevenuePercent(2525, { from: user });

    await expectRevert(tx, 'Ownable: caller is not the owner');
  });

  it('allows to update minTimeOfSubscription', async () => {
    const hours = (x) => time.duration.hours(x).toString();
    let tx = await this.protocolParameters.setMinTimeOfSubscription(hours(6));

    expectEvent(tx, 'MinTimeOfSubscriptionUpdated', {
      from: hours(5),
      to: hours(6),
    });

    let minTimeOfSubscription = await this.protocolParameters.minTimeOfSubscription();

    expect(minTimeOfSubscription.toString()).to.be.equal(hours(6));
  });

  it('fails to update minTimeOfSubscription with non governance account', async () => {
    const { user } = await getNamedAccounts();

    let tx = this.protocolParameters.setMinTimeOfSubscription(2525, { from: user });

    await expectRevert(tx, 'Ownable: caller is not the owner');
  });
});
