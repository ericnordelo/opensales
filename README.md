# Open Sales Manager contracts

## Overview

​
This is a simple contract who acts as a broker between sellers and buyers of NFTs, keeping
track of the interest of people on buying NFTs which can be not in sale at the moment, and
the interest of NFT holders on sell at some price if someone pays for it. The contract never
actually holds any token, instead just expect approvals, and cancel proposal when transactions
are confirmed but allowance is not enough from one of the participants.

The contract is upgradeable from openzeppelin UUPS (EIP-1822) proxy. there is a upgrade task that
can be used to easily upgrade the contract.  
 


## Addresses of deployed contract on mumbai network

OpenSalesManager_Proxy: 0xBB35Bc010d870558F6E559aD45b865059317aD9E  
OpenSalesManager_Implementation: 0x83f57ad3047CF8a48D3Da3D9eA1B2DbaA8FFD937  
​

## Addresses of deployed contracts on mainnet

_TODO: Add mainnet smart contract addresses_
​

## Deployment

​

### Environment Setup

​

#### 1. First clone this repository to your computer.

```
$ git clone ...
$ cd opensales/
```

#### 2. Then install the node modules.

```
$ npm install
```

#### 3. Create .env in the folder. Fill out all info needed on those files in according to .env.example file.

```
MNEMONIC=[the 12 mnemonic words]
INFURA_API_KEY = [Your Infura API key]
MUMBAI_RPC_URL=[url to MUMBAI]
PRIVATE_KEY=[private key for account]
```

### Run tests

```
$ npx hardhat test
```

### Deploy to Local Machine

#### 1. Run development server using Truffle.

```
$ hh node --no-deploy
```

​ 2. Deploy contracts.

```
$ hh deploy
```

​

### Deploy to Testnet (Mumbai)

​

```
$ hh deploy --network mumbai
```

​

### Deploy to Mainnet

​

```
$ hh deploy --network mainnet
```

​

## References

​

1. Hardhat: https://hardhat.org
   ​
