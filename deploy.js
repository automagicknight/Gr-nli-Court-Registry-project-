// scripts/deploy.js
// Deploys TrustIdentityAnchor, PMA_SBT, and HOG_GovernanceToken
// Run: npx hardhat run scripts/deploy.js --network polygonMumbai

const { ethers } = require("hardhat");
const fs         = require("fs");
const path       = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log("═".repeat(60));
  console.log("  House of Grønli ©™ — Contract Deployment");
  console.log("═".repeat(60));
  console.log(`  Network:   ${network.name} (chainId ${network.chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:   ${ethers.formatEther(balance)} MATIC`);
  console.log("─".repeat(60));

  // ── 1. TrustIdentityAnchor ───────────────────────────────────────────────
  console.log("\n[1/3] Deploying TrustIdentityAnchor...");

  // ⚠️  REPLACE these values with real data before mainnet deploy
  const LABEL          = "HOUSE OF GRONLI";
  const JURISDICTION   = "NO";
  // Established timestamp — must be in the past
  // Replace with actual founding date as Unix timestamp
  const ESTABLISHED_AT = Math.floor(Date.now() / 1000) - 300 * 86400; // 300 days ago (placeholder)
  const DOCUMENT_CID   = process.env.FOUNDING_DOC_CID
    || "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // REPLACE
  const VERSION        = "1.0";

  const AnchorFactory = await ethers.getContractFactory("TrustIdentityAnchor");
  const anchor        = await AnchorFactory.deploy(
    LABEL, JURISDICTION, ESTABLISHED_AT, DOCUMENT_CID, VERSION
  );
  await anchor.waitForDeployment();
  const anchorAddress = await anchor.getAddress();
  console.log(`  ✓ TrustIdentityAnchor: ${anchorAddress}`);

  // ── 2. PMA_SBT ──────────────────────────────────────────────────────────
  console.log("\n[2/3] Deploying PMA_SBT...");

  const SBTFactory = await ethers.getContractFactory("PMA_SBT");
  const sbt        = await SBTFactory.deploy(anchorAddress);
  await sbt.waitForDeployment();
  const sbtAddress = await sbt.getAddress();
  console.log(`  ✓ PMA_SBT: ${sbtAddress}`);

  // Authorise SBT as anchor consumer
  await anchor.authoriseConsumer(sbtAddress);
  console.log(`  ✓ SBT authorised as anchor consumer`);

  // ── 3. HOG_GovernanceToken ───────────────────────────────────────────────
  console.log("\n[3/3] Deploying HOG_GovernanceToken...");

  const HOGFactory = await ethers.getContractFactory("HOG_GovernanceToken");
  const hog        = await HOGFactory.deploy(deployer.address);
  await hog.waitForDeployment();
  const hogAddress = await hog.getAddress();
  console.log(`  ✓ HOG_GovernanceToken: ${hogAddress}`);

  // ── Save addresses ───────────────────────────────────────────────────────
  const addresses = {
    network:     network.name,
    chainId:     Number(network.chainId),
    deployer:    deployer.address,
    deployedAt:  new Date().toISOString(),
    contracts: {
      TrustIdentityAnchor: anchorAddress,
      PMA_SBT:             sbtAddress,
      HOG_GovernanceToken: hogAddress,
      // Fill these in after deploying remaining contracts:
      PMA_AssetRegistry:   "",
      PMA_LedgerEngine:    "",
      AragonDAO:           "",
    },
  };

  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));

  console.log("\n" + "─".repeat(60));
  console.log("  Deployment complete.");
  console.log("  Addresses saved to: deployed-addresses.json");
  console.log("\n  ⚠️  Next steps:");
  console.log("  1. Create Aragon DAO at app.aragon.org → Polygon");
  console.log("  2. Run scripts/transfer-roles.js with DAO shell address");
  console.log("  3. Issue founding Trustee SBT via Aragon Multisig proposal");
  console.log("  4. Verify contracts: npx hardhat run scripts/verify.js");
  console.log("─".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});