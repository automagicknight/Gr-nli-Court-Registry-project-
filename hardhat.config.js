require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },

  networks: {
    // ── Local development ──────────────────────────────────────────────────────
    hardhat: {
      chainId: 31337,
    },

    // ── Polygon Mumbai (testnet) ───────────────────────────────────────────────
    polygonMumbai: {
      url:      process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      chainId:  80001,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      gasPrice: "auto",
    },

    // ── Polygon Mainnet ────────────────────────────────────────────────────────
    polygon: {
      url:      process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      chainId:  137,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
      gasPrice: "auto",
    },
  },

  etherscan: {
    apiKey: {
      polygon:       process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
    },
  },

  gasReporter: {
    enabled:  process.env.REPORT_GAS === "true",
    currency: "USD",
    token:    "MATIC",
  },
};