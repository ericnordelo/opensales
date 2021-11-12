/**
 * @dev required configs
 *
 * usdt (address of the usdt token)
 * trax (address of the trax token)
 */

const networkConfig = {
  1337: {
    name: 'localhost',
  },
  31337: {
    name: 'hardhat',
  },
  56: {
    name: 'bsc',
  },
  80001: {
    name: 'mumbai',
    usdt: '',
    trax: '',
    validatorChainlinkNode: '0x0dc63a45c513bef5b84555d3fe56c227caa8e13e',
    validatorJobId: 'dcf1800fb9d443cdb512070046852c2d',
    validatorNodeFee: web3.utils.toWei('0.1'),
    linkToken: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB',
  },
  137: {
    name: 'polygon',
  },
};

module.exports = {
  networkConfig,
};
