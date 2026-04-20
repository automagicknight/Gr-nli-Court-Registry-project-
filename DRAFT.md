DRAFT.md — House of Grønli ©™ PMA DAO
Architecture Working Notes & Implementation Checklist
Status: DRAFT — Rev 1.0 — April 2026
Author: Kim Terje Rudschinat Grønli, Trustee
Contact: linktree.com/polliville
Network: Polygon Mainnet (chainId 137) · Aragon OSx
⚠️ How to Use This File
This DRAFT.md is the working scratchpad for the House of Grønli DAO build.
Use it to:
Track what has been built vs. what is still pending
Record design decisions and why they were made
Note open questions and blockers
Capture addresses, hashes, and references as the system is deployed
When a section is complete, mark it [x] and move key outputs into README.md or deployed-addresses.json.
🗺️ Build Status Overview
Component
Status
Notes
TrustIdentityAnchor.sol
🟡 Spec complete — needs trademark regnum
Replace NO-2024-XXXXXX with real number
PMA_SBT.sol
🟡 Spec complete — needs deploy
ERC-5114; Polygon
HOG_GovernanceToken.sol
🟡 Spec complete — needs deploy
Non-transferable; 1:1 with SBT
PMA_AssetRegistry.sol
🟡 Spec complete — needs deploy
ERC-721 trademark assets
PMA_LedgerEngine.sol
🟡 Spec complete — needs deploy
Double-entry; TAN hierarchy
Aragon DAO creation
⬜ Pending deploy
app.aragon.org → Polygon
TokenVoting plugin
⬜ Pending DAO creation
66% support / 50% quorum / 3 days
Multisig plugin
⬜ Pending DAO creation
3-of-5; list 5 signer addresses below
HOG admin transfer
⬜ Pending DAO address
Transfer to DAO Shell after creation
Founding Trustee SBT
⬜ Pending deploy
Kim Terje Rudschinat Grønli
Master TAN registration
⬜ Pending SBT
PMA-0001-A4F3C2-7E
SPV: Indre Stambane 5it
⬜ Pending governance proposal
First governance vote
ISO 20022 Transformer
🟡 Spec complete — needs deploy
Node.js service; Polygon events
Member Terminal
🟡 Spec complete — needs build
React + Wagmi + Viem
White Paper PDF
✅ Complete
docs/HouseOfGronli_PMA_WhitePaper_Rev1.pdf
Contract verification
⬜ Pending deploy
Polygonscan
Testnet (Mumbai) deploy
⬜ Pending
Do this FIRST
Mainnet deploy
⬜ Pending testnet
Final step
Legend: ✅ Done · 🟡 In Progress · ⬜ Not Started · 🔴 Blocked
📌 Open Questions & Decisions Needed
Q1 — Trademark Registration Number
Question: What is the exact Norwegian trademark registration number for House of Grønli ©™?
Where it goes: TrustIdentityAnchor constructor arg 1; all ISO 20022 PtyId fields
Status: ⬜ PENDING — needed before any contract deployment
registrationNumber = "NO-____-______"   ← FILL IN
registrationDate   = "20__-__-__"       ← FILL IN (must be ≥9 months before SPV date)
wipoRef            = ""                  ← Fill in if Madrid Protocol registered
Q2 — Trademark Certificate IPFS CID
Question: Has the trademark certificate PDF been uploaded to IPFS?
Where it goes: TrustIdentityAnchor constructor arg 6 (keccak256 of CID)
Status: ⬜ PENDING
# To pin the certificate:
curl -X POST \
  -H "Authorization: Bearer YOUR_PINATA_JWT" \
  -F "file=@trademark-certificate.pdf" \
  https://api.pinata.cloud/pinning/pinFileToIPFS

# Record the resulting CID here:
TRADEMARK_CERT_CID = "bafybei..."   ← FILL IN
Q3 — Multisig Signer Wallets
Question: Who are the 5 multisig signers? Need wallet addresses.
Where it goes: Aragon Multisig plugin setup
Status: ⬜ PENDING
Signer 1 (Trustee): 0x...    ← Kim Terje Rudschinat Grønli
Signer 2 (Admin):   0x...
Signer 3 (Admin):   0x...
Signer 4 (Admin):   0x...
Signer 5 (Admin):   0x...
Q4 — Trustee Wallet Address
Question: What wallet address will be the founding Trustee?
Where it goes: VITE_TRUSTEE_ADDRESS in .env; founding SBT mint target
Status: ⬜ PENDING
TRUSTEE_ADDRESS = "0x..."   ← FILL IN
Q5 — MATIC Gas Budget
Question: Is there sufficient MATIC in the deployer wallet?
Estimated cost: ~2–5 MATIC for full deployment (at current gas prices)
Check: https://polygonscan.com/address/YOUR_DEPLOYER_WALLET
Status: ⬜ CHECK BEFORE DEPLOY
Q6 — IPFS / Pinata Setup
Question: Is the Pinata account created and JWT available?
Status: ⬜ PENDING
IPFS_JWT = "eyJ..."   ← Pinata JWT; add to .env
Q7 — Indre Stambane 5it SPV Details
Question: What is the formal description, asset list, and member allocation table for the SPV?
Where it goes: First governance proposal; SPV metadata CID
Status: ⬜ PENDING — needs separate document
📐 Design Decisions (Recorded)
Decision 1 — Polygon over Besu
Date: April 2026
Decision: Use Polygon Mainnet instead of private Hyperledger Besu
Rationale:
Public auditability for governance votes
Aragon OSx already deployed on Polygon — no need to run own validator set
Gas costs ~$0.001 per transaction vs. Ethereum mainnet
MetaMask / WalletConnect work natively — no custom RPC setup for members
Trade-off: Ledger entries are publicly visible on Polygonscan (mitigated by PPOA session gating — data is on-chain but write access is private)
Decision 2 — Non-transferable HOG Governance Token
Date: April 2026
Decision: HOG token transfer() reverts unconditionally
Rationale: Governance voice must track membership (SBT), not wealth. A transferable token would allow vote-buying and undermine the PMA model.
Decision 3 — 3-of-5 Multisig for SBT Issuance
Date: April 2026
Decision: SBT issuance goes through Multisig plugin, not TokenVoting
Rationale: New member issuance should not require a 3-day public vote. Multisig allows the Trustee + 2 admins to approve quickly while still requiring multi-party consensus.
Decision 4 — ISO 20022 as Internal Middleware Only
Date: April 2026
Decision: ISO 20022 XML is generated internally; public-network credentials (LEI/IBAN) are substituted only at the Gateway Adapter layer
Rationale: Internal settlement uses private PMA identifiers (PMA_TRADEMARK_ANCHOR, PMA_TAN). These must never appear in public SWIFT/SEPA messages. The Gateway Adapter enforces the boundary.
Decision 5 — PPOA Session = 1 Hour
Date: April 2026
Decision: PPOA EIP-712 session signatures expire after 3600 seconds
Rationale: Balances usability (member doesn't re-sign constantly) against security (compromised session has limited window). Can be tightened to 900s for admin operations via a separate adminSessionExpiry parameter.
🔨 Implementation Checklist
Phase 1 — Preparation (before any code)
[ ] Obtain exact trademark registration number and date
[ ] Upload trademark certificate to IPFS; record CID
[ ] Confirm 5 multisig signer wallet addresses
[ ] Confirm Trustee wallet address
[ ] Ensure deployer wallet has ≥5 MATIC on Polygon
[ ] Create Pinata account; generate JWT
[ ] Create WalletConnect project; get project ID
[ ] Create Polygonscan API key
Phase 2 — Testnet (Mumbai)
[ ] Run npx hardhat run scripts/deploy-hog-dao.js --network polygonMumbai
[ ] Verify all 5 contracts deploy and link correctly
[ ] Create test Aragon DAO on Mumbai
[ ] Issue test Trustee SBT; verify HOG token minted
[ ] Post test ledger entry; verify ISO 20022 transformer produces valid XML
[ ] Run reconciliation cycle end-to-end
[ ] Test Terminal auth flow (SBT check → PPOA sign → session)
[ ] Fix any issues found on testnet
Phase 3 — Mainnet Deployment
[ ] Run npx hardhat run scripts/deploy-hog-dao.js --network polygon
[ ] Record all addresses in deployed-addresses.json
[ ] Create Aragon DAO at app.aragon.org → Polygon
[ ] Transfer HOG admin to DAO Shell
[ ] Run scripts/grant-permissions.js
[ ] Issue founding Trustee SBT
[ ] Register master TAN
[ ] Verify all contracts on Polygonscan
Phase 4 — SPV Setup
[ ] Draft Indre Stambane 5it SPV governance proposal
[ ] Submit proposal via Aragon TokenVoting
[ ] Members vote (3 days)
[ ] Execute registerSPV() on LedgerEngine
[ ] Register SPV asset tokens (initial tranche)
Phase 5 — Operations
[ ] Start ISO 20022 Transformer service
[ ] Deploy Member Terminal
[ ] Onboard first non-Trustee members (Multisig SBT issuance)
[ ] Complete first reconciliation cycle
📋 Key References
Resource
URL
Aragon OSx Docs
https://devs.aragon.org
Aragon App (Polygon)
https://app.aragon.org/#/daos/polygon/
Polygon RPC
https://polygon-rpc.com
Polygonscan
https://polygonscan.com
Polygon Faucet (Mumbai)
https://faucet.polygon.technology
Aragon Subgraph (Polygon)
https://subgraph.satsuma-prod.com/aragon/osx-polygon/api
ERC-5114 Spec
https://eips.ethereum.org/EIPS/eip-5114
ISO 20022 Message Catalogue
https://www.iso20022.org/iso-20022-message-definitions
OpenZeppelin Contracts
https://docs.openzeppelin.com/contracts
Hardhat Docs
https://hardhat.org/docs
Pinata (IPFS)
https://app.pinata.cloud
WalletConnect Cloud
https://cloud.walletconnect.com
White Paper
./docs/HouseOfGronli_PMA_WhitePaper_Rev1.pdf
PMA Utility Spec (Rev 2)
./docs/pma-utility-spec-v2.jsx
Aragon DAO Spec
./docs/AragonDAO_HouseOfGronli_Spec.jsx
Contact / Portal
https://linktree.com/polliville
📝 Changelog
Date
Rev
Change
April 2026
1.0
Initial draft — Aragon OSx on Polygon architecture
—
—
Trademark Identity Anchor spec
—
—
ISO 20022 field mapping for private settlement
—
—
SPV: Indre Stambane 5it ring-fenced entity
PRIVATE & CONFIDENTIAL — House of Grønli ©™ — For authorised members only.
© House of Grønli ©™ 2026 · linktree.com/polliville