module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // this contract is upgradeable through uups (EIP-1822)
  await deploy('OpenSalesManager', {
    from: deployer,
    proxy: {
      proxyContract: 'UUPSProxy',
      execute: {
        init: {
          methodName: 'initialize',
          args: [],
        },
      },
    },
    log: true,
    args: [],
  });
};

module.exports.tags = ['open_sales'];
