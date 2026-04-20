{
  "name": "house-of-gronli-dao",
  "version": "1.0.0",
  "description": "House of Grønli ©™ PMA — Aragon DAO smart contracts on Polygon",
  "private": true,
  "scripts": {
    "compile":      "hardhat compile",
    "test":         "hardhat test",
    "test:gas":     "REPORT_GAS=true hardhat test",
    "coverage":     "hardhat coverage",
    "deploy:mumbai": "hardhat run scripts/deploy.js --network polygonMumbai",
    "deploy:polygon": "hardhat run scripts/deploy.js --network polygon",
    "verify":       "hardhat run scripts/verify.js --network polygon",
    "clean":        "hardhat clean"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.0",
    "chai": "^4.3.7",
    "hardhat": "^2.19.0",
    "hardhat-gas-reporter": "^1.0.9",
    "solidity-coverage": "^0.8.5",
    "dotenv": "^16.3.1"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.0"
  }
}