🏛️ House of Grønli ©™ — PMA Administrative DAO
Private Membership Association · Aragon OSx · Polygon Mainnet
Sovereign administrative infrastructure for private trust management, trademark-anchored identity, and ISO 20022 internal settlement.
�
�
�
�
�
Load image
Load image
Load image
Load image
Load image
📋 Table of Contents
Overview
Architecture
Contract Addresses
Prerequisites
Quick Start
Deployment
Member Terminal
ISO 20022 Transformer
Governance
Repository Structure
Security
Contact
License
Overview
House of Grønli ©™ is a Private Membership Association (PMA) operating a sovereign administrative infrastructure on Polygon (MATIC) via the Aragon OSx DAO framework.
The system provides:
Capability
Implementation
Trademark Identity Anchor
TrustIdentityAnchor.sol — immutable on-chain trademark root
Membership Credential
PMA_SBT.sol — ERC-5114 Soulbound NFT; non-transferable
Governance
Aragon TokenVoting + Multisig plugins; HOG governance token
Asset Management
PMA_AssetRegistry.sol — ERC-721 trademark asset tokens
Private Ledger
PMA_LedgerEngine.sol — double-entry TAN ledger
Settlement Messaging
ISO 20022 Transformer — pacs.008 / camt.053 XML
SPV
Indre Stambane 5it — ring-fenced infrastructure project entity
Privacy model: All membership operations are gated by the Soulbound NFT. Governance is on Polygon (public chain) but administrative write access requires a valid Private Power of Attorney (PPOA) session signature for every operation.
Architecture
┌─────────────────────────────────────────────────────────────┐
│               MEMBER TERMINAL  (React + Wagmi)              │
│   MetaMask / WalletConnect → SBT Check → PPOA EIP-712 Sign │
└───────────────────────────┬─────────────────────────────────┘
                             │
┌───────────────────────────▼─────────────────────────────────┐
│             ARAGON OSx DAO SHELL  (Polygon 137)             │
│   TokenVoting Plugin  ·  Multisig 3-of-5  ·  HOG Token     │
└───────────────────────────┬─────────────────────────────────┘
                             │
┌───────────────────────────▼─────────────────────────────────┐
│              CUSTOM PMA CONTRACTS  (Polygon 137)            │
│  TrustIdentityAnchor → PMA_SBT → AssetRegistry             │
│                              ↘  LedgerEngine (TAN/SPV)      │
└───────────────────────────┬─────────────────────────────────┘
                             │  events
┌───────────────────────────▼─────────────────────────────────┐
│           ISO 20022 TRANSFORMER  (TypeScript service)       │
│   pacs.008 / camt.053 XML  →  XSD Validate  →  IPFS Pin    │
└─────────────────────────────────────────────────────────────┘
Contract Dependency Graph
TrustIdentityAnchor
  └── PMA_SBT(anchorAddr)
        ├── HOG_GovernanceToken(sbtAddr, daoShell)
        ├── PMA_AssetRegistry(sbtAddr, anchorAddr)
        └── PMA_LedgerEngine(sbtAddr, assetRegistryAddr)
              ├── [TAN master records]
              ├── [SPV: Indre Stambane 5it sub-TANs]
              └── [Double-entry ledger entries]
Contract Addresses
⚠️ Fill in after deployment. See Deployment.
Contract
Polygon Address
Polygonscan
TrustIdentityAnchor
0x...
View
PMA_SBT
0x...
View
HOG_GovernanceToken
0x...
View
PMA_AssetRegistry
0x...
View
PMA_LedgerEngine
0x...
View
Aragon DAO Shell
0x...
View on Aragon
After deployment, addresses are also saved to deployed-addresses.json.
Prerequisites
Node.js ≥ 18 and npm ≥ 9
MATIC in your deployer wallet (~2–5 MATIC covers full deployment)
MetaMask configured for Polygon Mainnet (chainId 137)
Polygonscan API key — Get one free
IPFS pinning service — Pinata or web3.storage
Add Polygon to MetaMask
Setting
Value
Network Name
Polygon Mainnet
RPC URL
https://polygon-rpc.com
Chain ID
137
Symbol
MATIC
Explorer
https://polygonscan.com
Or click: Add to MetaMask via Chainlist
Quick Start
1. Clone the repository
git clone https://github.com/YOUR_ORG/house-of-gronli-dao.git
cd house-of-gronli-dao
npm install
2. Configure environment
cp .env.example .env
# Edit .env — add your deployer private key, API keys, and contract addresses
3. Test on Mumbai (testnet first)
# Deploy to Polygon Mumbai testnet
npx hardhat run scripts/deploy-hog-dao.js --network polygonMumbai

# Get free test MATIC: https://faucet.polygon.technology
4. Deploy to Polygon Mainnet
npx hardhat run scripts/deploy-hog-dao.js --network polygon
5. Create Aragon DAO
Go to app.aragon.org
Click New DAO → select Polygon network
Choose Token Voting plugin — paste HOG_GovernanceToken address
Install Multisig plugin — add 5 signer addresses (Trustee + 4 Admins)
Copy the resulting DAO Shell address → add to .env as VITE_DAO_ADDRESS
Transfer HOG_GovernanceToken admin role to DAO Shell:
npx hardhat run scripts/transfer-admin-to-dao.js --network polygon
6. Issue founding Trustee SBT
npx hardhat run scripts/issue-founding-sbt.js --network polygon
7. Start the member terminal
cd terminal
npm install
npm run dev
# Open http://localhost:5173
Deployment
Full 13-step deployment sequence:
Step
Script
Action
1
deploy-hog-dao.js
Deploy TrustIdentityAnchor
2
deploy-hog-dao.js
Deploy PMA_SBT
3
deploy-hog-dao.js
Deploy HOG_GovernanceToken
4
deploy-hog-dao.js
Deploy PMA_AssetRegistry
5
deploy-hog-dao.js
Deploy PMA_LedgerEngine
6
Manual
Create Aragon DAO at app.aragon.org
7
transfer-admin-to-dao.js
Transfer HOG admin to DAO Shell
8
grant-permissions.js
Grant ISSUE_SBT_PERMISSION to DAO Shell
9
grant-permissions.js
Grant MINTER_ROLE to DAO Shell on HOG token
10
issue-founding-sbt.js
Issue Trustee SBT + mint HOG voting token
11
register-tan.js
Register master TAN in LedgerEngine
12
Aragon proposal
Register Indre Stambane 5it SPV via governance
13
verify-contracts.js
Verify all contracts on Polygonscan
Verify on Polygonscan
npx hardhat verify --network polygon \
  <CONTRACT_ADDRESS> \
  <CONSTRUCTOR_ARG_1> <CONSTRUCTOR_ARG_2>
Member Terminal
The React member terminal is located in ./terminal/.
Authentication flow
1. Connect wallet (MetaMask / WalletConnect)
2. Check SBT balance on Polygon
3. Verify SBT is active (not revoked)
4. Sign EIP-712 PPOA session (1-hour expiry)
5. Access terminal modules per your SBT tier
Terminal modules
Module
Route
Access
Dashboard
/terminal
All active members
Identity Anchor
/terminal/anchor
Trustee only
Identity Vault
/terminal/identity
All active members
Asset Registry
/terminal/assets
Member + Admin
Ledger Console
/terminal/ledger
Member + Admin
Reconciliation
/terminal/reconcile
Member + Admin
ISO Messages
/terminal/iso-messages
Member + Admin
SPV Manager
/terminal/spv
Administrator
C/O Record Editor
/terminal/care-of
Trustee only
Admin Panel
/terminal/admin
Administrator
Build for production
cd terminal
npm run build
# Output in ./terminal/dist/
ISO 20022 Transformer
The middleware service listens for Polygon events and builds ISO 20022 XML messages.
Start the transformer
cd iso-transformer
npm install
cp ../.env .env
npm start
# Listening for EntryPosted and ReconciliationClosed events on Polygon
Message types produced
ISO Message
Trigger
Purpose
pacs.008
EntryPosted event
Member-to-member settlement instruction
camt.053
ReconciliationClosed event
TAN period account statement
camt.056
Capital call proposal executed
SPV capital call notice
camt.054
Revenue entry posted
Debit/credit notification
All XML is validated against XSD schemas in ./iso-transformer/schemas/ before pinning to IPFS.
Governance
Voting parameters
Parameter
Value
Support threshold
66% (supermajority)
Minimum participation
50% (quorum)
Minimum duration
3 days
Min proposer voting power
1 HOG token
Admin multisig
3-of-5 signers
Upgrade timelock
72 hours
Submit a proposal
Go to your DAO at app.aragon.org
Click New Proposal
Select Token Voting (standard proposals) or Multisig (admin actions)
Fill in title, description, and on-chain actions
Submit — voting opens immediately
Proposal templates
Pre-built calldata templates are in ./docs/aragon-proposal-templates/:
issue-sbt.json — Issue new member SBT
register-asset.json — Register trademark asset token
register-spv.json — Register new SPV entity
Repository Structure
house-of-gronli-dao/
├── README.md
├── DRAFT.md                    # Architecture draft & working notes
├── deployed-addresses.json     # Post-deployment contract addresses
├── contracts/                  # Solidity smart contracts
├── scripts/                    # Hardhat deployment scripts
├── test/                       # Contract tests
├── iso-transformer/            # ISO 20022 middleware service
├── terminal/                   # React member terminal (Wagmi/Viem)
├── docs/                       # White paper, DID document, field mappings
└── hardhat.config.js
Security
No member private keys are held by the Association. All cryptographic operations are performed by the member's own wallet.
Session tokens are memory-only. No persistent session storage. Page refresh requires full re-authentication.
Rate limiting: 30 write transactions per TAN per rolling 24-hour window.
Upgrade timelock: All contract upgrades require 72-hour timelock after 5-of-7 multisig approval.
PPOA session expiry: All write sessions expire after 1 hour maximum.
Audits: Smart contract audit to be completed before mainnet launch. See ./docs/audit/.
Responsible disclosure
Security issues should be reported privately to the Trustee via the contact link below. Do not open public GitHub issues for security vulnerabilities.
Contact
House of Grønli ©™ — Private Membership Association
🌐 Portal: linktree.com/polliville
👤 Senior Lien Holder / Trustee: Kim Terje Rudschinat Grønli
📄 White Paper: docs/HouseOfGronli_PMA_WhitePaper_Rev1.pdf
🏛️ Aragon DAO: app.aragon.org (update after deploy)
License
PRIVATE — House of Grønli ©™ — All Rights Reserved
This repository and all its contents are private and confidential. For authorised members of House of Grønli ©™ PMA only. Unauthorised reproduction, distribution, or use is strictly prohibited.
© House of Grønli ©™ 2026