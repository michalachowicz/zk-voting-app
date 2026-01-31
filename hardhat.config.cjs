require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        arbitrumOne: {
            url: process.env.ARBITRUM_RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
            chainId: 42161
        },
        arbitrumSepolia: {
            url: process.env.ARBITRUM_SEPOLIA_RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
            chainId: 421614
        }
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
    },
    sourcify: {
        enabled: false
    },
    paths: {
        sources: "./contracts",
        tests: "./test", 
        cache: "./cache",
        artifacts: "./build/artifacts"
    },
    gasReporter: {
        enabled: true,
        currency: 'USD',
        gasPrice: 0.07,
        excludeContracts: ['MockVerifier'],
        noColors: false,
        showTimeSpent: true,
    }
};