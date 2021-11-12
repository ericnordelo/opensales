const SongsRouter = artifacts.require('SongsRouter');
const SongsCollection = artifacts.require('SongsCollection');

const { constants, expectRevert } = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');
const { assert } = require('chai');

describe('SongsRouter', function () {
  beforeEach(async () => {
    await deployments.fixture(['songs_router', 'songs_collection']);

    let deployment = await deployments.get('SongsRouter');
    this.songsRouter = await SongsRouter.at(deployment.address);

    deployment = await deployments.get('SongsCollection');
    this.songsCollection = await SongsCollection.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.songsRouter.address);
  });

  describe('blacklisting and whitelisting', () => {
    const WHITELISTER_ROLE = web3.utils.keccak256('WHITELISTER_ROLE');

    it('should allow to whitelist a collection from governance', async () => {
      let collection = constants.ZERO_ADDRESS;

      let isWhitelisted = await this.songsRouter.whitelistedCollections(collection);
      assert.isFalse(isWhitelisted);

      // whitelist the collection
      await this.songsRouter.whitelistCollection(collection);

      isWhitelisted = await this.songsRouter.whitelistedCollections(collection);
      assert.isTrue(isWhitelisted);
    });

    it('should allow to blacklist a collection from governance', async () => {
      let collection = constants.ZERO_ADDRESS;

      // whitelist the collection
      await this.songsRouter.whitelistCollection(collection);

      let isWhitelisted = await this.songsRouter.whitelistedCollections(collection);
      assert.isTrue(isWhitelisted);

      // blacklist the collection
      await this.songsRouter.blacklistCollection(collection);

      isWhitelisted = await this.songsRouter.whitelistedCollections(collection);
      assert.isFalse(isWhitelisted);
    });

    it('should not whitelist from not governance', async () => {
      let collection = constants.ZERO_ADDRESS;
      const { user } = await getNamedAccounts();

      let revertMessage = `AccessControl: account ${user.toLowerCase()} is missing role ${WHITELISTER_ROLE}`;

      // whitelist the collection
      await expectRevert(this.songsRouter.whitelistCollection(collection, { from: user }), revertMessage);
    });

    it('should not blacklist from not governance', async () => {
      let collection = constants.ZERO_ADDRESS;
      const { user } = await getNamedAccounts();

      let revertMessage = `AccessControl: account ${user.toLowerCase()} is missing role ${WHITELISTER_ROLE}`;

      // whitelist the collection
      await expectRevert(this.songsRouter.blacklistCollection(collection, { from: user }), revertMessage);
    });
  });

  describe('stake feature', () => {
    it('stake only from approved collections', async () => {
      let collection = constants.ZERO_ADDRESS;

      await expectRevert(this.songsRouter.stake(collection, 1, constants.ZERO_ADDRESS), 'Collection not approved');
    });

    it("can't stake a token twice", async () => {
      const { user } = await getNamedAccounts();

      // mint the token
      await this.songsCollection.safeMint(user, 'uri');

      // approve the token
      await this.songsCollection.approve(this.songsRouter.address, 0, { from: user });

      // whitelist the collection
      await this.songsRouter.whitelistCollection(this.songsCollection.address);

      // stake the first time
      await this.songsRouter.stake(this.songsCollection.address, 0, constants.ZERO_ADDRESS, { from: user });

      // try to stake the same token
      await expectRevert(
        this.songsRouter.stake(this.songsCollection.address, 0, constants.ZERO_ADDRESS, { from: user }),
        'Song already staked'
      );
    });

    it('increment the stake counter and emit the event', async () => {
      const { user } = await getNamedAccounts();

      // mint the token
      await this.songsCollection.safeMint(user, 'uri');

      // approve the token
      await this.songsCollection.approve(this.songsRouter.address, 0, { from: user });

      // whitelist the collection
      await this.songsRouter.whitelistCollection(this.songsCollection.address);

      let oldStakeCounter = await this.songsRouter.stakedSongsCounter();

      // stake the first time
      let tx = await this.songsRouter.stake(this.songsCollection.address, 0, constants.ZERO_ADDRESS, { from: user });

      expectEvent(tx, 'SongStaked', { collection: this.songsCollection.address, tokenId: '0', staker: user });

      let newStakeCounter = await this.songsRouter.stakedSongsCounter();

      assert.strictEqual(oldStakeCounter.toNumber() + 1, newStakeCounter.toNumber());
    });
  });
});
