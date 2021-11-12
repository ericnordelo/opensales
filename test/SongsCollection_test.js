const SongsCollection = artifacts.require('SongsCollection');

describe('SongsCollection', function () {
  beforeEach(async () => {
    await deployments.fixture(['songs_collection']);
    let deployment = await deployments.get('SongsCollection');

    this.songsCollection = await SongsCollection.at(deployment.address);
  });

  it('should be deployed', async () => {
    assert.isOk(this.songsCollection.address);
  });
});
