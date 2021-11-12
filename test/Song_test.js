const SongsRouter = artifacts.require('SongsRouter');
const LinkTokenMock = artifacts.require('LinkTokenMock');
const SongsCollection = artifacts.require('SongsCollection');
const RevenueOracle = artifacts.require('RevenueOracle');
const FundsManager = artifacts.require('FundsManager');
const Song = artifacts.require('Song');

const { constants, expectEvent } = require('@openzeppelin/test-helpers');

describe('Song', function () {
  beforeEach(async () => {
    await deployments.fixture(['songs_router', 'songs_collection', 'funds_manager']);

    let deployment = await deployments.get('SongsRouter');
    this.songsRouter = await SongsRouter.at(deployment.address);

    deployment = await deployments.get('SongsCollection');
    this.songsCollection = await SongsCollection.at(deployment.address);

    deployment = await deployments.get('RevenueOracle');
    this.oracle = await RevenueOracle.at(deployment.address);

    deployment = await deployments.get('FundsManager');
    this.fundsManager = await FundsManager.at(deployment.address);

    const { user } = await getNamedAccounts();

    // mint the token
    await this.songsCollection.safeMint(user, 'uri');

    // approve the token
    await this.songsCollection.approve(this.songsRouter.address, 0, { from: user });

    // whitelist the collection
    await this.songsRouter.whitelistCollection(this.songsCollection.address);

    // stake the first time
    let tx = await this.songsRouter.stake(this.songsCollection.address, 0, constants.ZERO_ADDRESS, { from: user });

    let log = expectEvent(tx, 'SongStaked', { collection: this.songsCollection.address, tokenId: '0', staker: user });

    this.song = await Song.at(log.args.songContract);
  });

  describe('claim revenue', () => {
    it('should allow to claim with positive revenue', async () => {
      let deployment = await deployments.get('LinkTokenMock');
      let linkToken = await LinkTokenMock.at(deployment.address);

      let tx = await this.song.claim();

      // emit the event in the song contract
      expectEvent(tx, 'ClaimRequested', {});

      tx = await linkToken.callback(this.oracle.address);

      // emit the event after response is received (different transaction ourtise local networks)
      await expectEvent.inTransaction(tx.tx, this.fundsManager, 'RevenueDistributed', {
        songContract: this.song.address,
        revenue: '10000',
      });
    });

    it('should allow to claim with 0 revenue', async () => {
      let deployment = await deployments.get('LinkTokenMock');
      let linkToken = await LinkTokenMock.at(deployment.address);

      await linkToken.setRevenue(0);

      let tx = await this.song.claim();

      // emit the event in the song contract
      expectEvent(tx, 'ClaimRequested', {});

      tx = await linkToken.callback(this.oracle.address);

      // emit the event after response is received (different transaction ourtise local networks)
      await expectEvent.inTransaction(tx.tx, this.fundsManager, 'RevenueDistributed', {
        songContract: this.song.address,
        revenue: '0',
      });
    });
  });
});
