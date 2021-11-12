const StringifyClientMock = artifacts.require('StringifyClientMock');

describe('Stringify', async function () {
  beforeEach(async () => {
    this.mock = await StringifyClientMock.new();
  });

  it('should convert uint to string', async () => {
    let string = await this.mock.uintToString(1000);

    expect(string).to.be.equal('1000');
  });

  it('should convert address to string', async () => {
    const { deployer } = await getNamedAccounts();
    let string = await this.mock.addressToString(deployer);

    expect(string).to.be.equal(deployer.slice(2).toLowerCase());
  });

  it('should convert string to bytes32', async () => {
    let phrase = 'some phrase for testing purposes';
    let bytes = ethers.utils.toUtf8Bytes(phrase);

    let bytes32 = await this.mock.stringToBytes32(phrase);

    expect(bytes32).to.be.equal(ethers.utils.hexZeroPad(bytes, 32));
  });

  it('string to bytes32 empty case', async () => {
    let phrase = '';
    let bytes = ethers.utils.toUtf8Bytes(phrase);

    let bytes32 = await this.mock.stringToBytes32(phrase);

    expect(bytes32).to.be.equal(ethers.utils.hexZeroPad(bytes, 32));
  });

  it('uint to string 0 case', async () => {
    let string = await this.mock.uintToString(0);

    expect(string).to.be.equal('0');
  });
});
