import { useState } from "react";

const sections = [
  {
    id: "overview",
    code: "§ 1.0",
    title: "System Overview",
    subsections: [
      {
        id: "1.1",
        title: "Purpose & Scope",
        content: `The PMA Utility is a sovereign administrative terminal enabling members of a Private Membership Association to manage trademarked private-property assets, execute Power of Attorney authorizations, and reconcile outstanding ledger obligations — all gated behind cryptographic identity verified by a non-transferable Soulbound NFT (SBT).

The system operates exclusively within the private domain of the Association. No public-facing API, no third-party KYC, and no centralized custodian holds member keys. The Trust Account Number (TAN) serves as the canonical identifier linking every on-chain event to the Association's internal ledger.`,
      },
      {
        id: "1.2",
        title: "Architectural Pillars",
        content: null,
        table: {
          headers: ["Pillar", "Technology / Standard", "Role"],
          rows: [
            ["Identity Layer", "ERC-5114 Soulbound NFT", "Non-transferable membership credential minted once per member"],
            ["Authorization Layer", "Private Power of Attorney (PPOA)", "Off-chain notarized doc hash stored on-chain; grants administrative write access"],
            ["Asset Registry", "ERC-721 / ERC-1155 (private subnet)", "Trademarked asset tokens with IPFS-anchored trademark certificates"],
            ["Ledger Engine", "Double-entry ledger smart contract", "Debit / credit reconciliation against the Trust Account Number"],
            ["Terminal UI", "React + Wagmi + ethers.js", "Member-facing dashboard; wallet-gated, read/write via SBT auth"],
            ["Storage", "IPFS + Filecoin (encrypted)", "Immutable document archives; AES-256 envelope, member-key decrypt"],
          ],
        },
      },
    ],
  },
  {
    id: "sbt",
    code: "§ 2.0",
    title: "Soulbound NFT — Membership Credential",
    subsections: [
      {
        id: "2.1",
        title: "Token Standard & Non-Transferability",
        content: `Implements ERC-5114 (Soulbound Token) with an additional Association-specific extension. Each token is permanently bound to the minting wallet address. Transfer, approval, and setApprovalForAll functions are overridden to revert unconditionally.

Token metadata includes: Member ID, membership tier (Observer / Member / Administrator), issuance timestamp, PPOA document hash, and revocation status. Metadata is stored on IPFS, with the CID recorded in the contract's immutable mapping.`,
        code: `// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PMA_SBT is ERC721, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct MemberRecord {
        uint256 tokenId;
        address boundWallet;
        string  membershipTier;   // "Observer" | "Member" | "Administrator"
        bytes32 ppoaDocHash;      // keccak256 of notarized PPOA PDF
        uint256 issuedAt;
        bool    revoked;
    }

    mapping(address => MemberRecord) public memberRecords;
    mapping(uint256 => address)      private _tokenOwner;

    constructor() ERC721("PMA Membership", "PMA-SBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function issueMembership(
        address  _to,
        string   calldata _tier,
        bytes32  _ppoaHash,
        string   calldata _metadataCID
    ) external onlyRole(ISSUER_ROLE) {
        require(balanceOf(_to) == 0, "SBT: wallet already holds membership");
        uint256 tokenId = uint256(keccak256(abi.encodePacked(_to, block.timestamp)));
        _safeMint(_to, tokenId);
        memberRecords[_to] = MemberRecord(tokenId, _to, _tier, _ppoaHash, block.timestamp, false);
        _tokenOwner[tokenId] = _to;
        // store metadata CID in tokenURI mapping (omitted for brevity)
    }

    // --- Block all transfers (Soulbound enforcement) ---
    function transferFrom(address, address, uint256) public pure override {
        revert("SBT: non-transferable");
    }
    function safeTransferFrom(address, address, uint256) public pure override {
        revert("SBT: non-transferable");
    }
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("SBT: non-transferable");
    }
    function approve(address, uint256) public pure override {
        revert("SBT: approvals disabled");
    }
    function setApprovalForAll(address, bool) public pure override {
        revert("SBT: approvals disabled");
    }
}`,
      },
      {
        id: "2.2",
        title: "Issuance & Revocation Lifecycle",
        content: null,
        table: {
          headers: ["State", "Trigger", "Effect"],
          rows: [
            ["Pending", "Member submits application + PPOA doc", "Off-chain review queue; no on-chain state"],
            ["Active", "ISSUER_ROLE calls issueMembership()", "SBT minted; terminal access granted"],
            ["Suspended", "Admin calls setSuspended(address, true)", "SBT remains; terminal read-only; asset writes blocked"],
            ["Revoked", "Admin calls revokeMembership(address)", "SBT burned; all active sessions invalidated; TAN frozen"],
          ],
        },
      },
    ],
  },
  {
    id: "ppoa",
    code: "§ 3.0",
    title: "Private Power of Attorney (PPOA)",
    subsections: [
      {
        id: "3.1",
        title: "Legal Instrument Design",
        content: `The PPOA is a private, notarized legal instrument granting the Association's Administrative Trustee limited authority to act on the member's behalf for the sole purpose of internal record-keeping, ledger reconciliation, and asset title management within the Association's private registry.

The instrument is NOT a general power of attorney and confers no authority outside the Association's private domain. Scope is explicitly limited to: (1) signing ledger entries, (2) registering trademark asset tokens, (3) initiating TAN reconciliation requests.`,
      },
      {
        id: "3.2",
        title: "On-Chain Anchoring",
        content: `Upon notarization, the PPOA PDF is encrypted with the member's public key and pinned to IPFS. The resulting CID is hashed (keccak256) and submitted to the SBT contract via updatePPOAHash(). This creates a tamper-evident, timestamped record of the authorization.

Signature verification: The terminal requires members to sign a structured EIP-712 message referencing the PPOA hash before any write operation. This proves live key control and links the session to the authenticated PPOA.`,
        code: `// EIP-712 Domain & Type Hash for PPOA session authorization
const DOMAIN = {
  name: "PMA Administrative Terminal",
  version: "1",
  chainId: <PRIVATE_CHAIN_ID>,
  verifyingContract: "<SBT_CONTRACT_ADDRESS>",
};

const PPOA_SESSION_TYPE = {
  PPOASession: [
    { name: "memberAddress", type: "address" },
    { name: "ppoaHash",      type: "bytes32" },
    { name: "sessionNonce",  type: "uint256" },
    { name: "expiry",        type: "uint256" },
  ],
};

// Member signs this before any administrative write
const signature = await signer.signTypedData(
  DOMAIN,
  PPOA_SESSION_TYPE,
  {
    memberAddress: memberWallet,
    ppoaHash:      activePPOAHash,      // from SBT record
    sessionNonce:  await getNonce(),
    expiry:        Math.floor(Date.now() / 1000) + 3600, // 1h
  }
);`,
      },
    ],
  },
  {
    id: "assets",
    code: "§ 4.0",
    title: "Private Trademarked Asset Registry",
    subsections: [
      {
        id: "4.1",
        title: "Asset Token Architecture",
        content: `Each trademarked asset is represented as an ERC-721 token on the Association's private subnet. The token's metadata envelope references: USPTO / WIPO trademark registration number, trademark class(es), registration date, owner's TAN, IPFS CID of the trademark certificate PDF (AES-256 encrypted), and chain-of-custody history.

Assets are minted exclusively by wallets holding an Active SBT with Administrator tier, or by wallets presenting a valid PPOA session signature. Public mint is permanently disabled.`,
      },
      {
        id: "4.2",
        title: "Asset Operations via Terminal",
        content: null,
        table: {
          headers: ["Operation", "Required Auth", "Smart Contract Function"],
          rows: [
            ["Register new asset", "Active SBT + PPOA signature", "registerAsset(tanId, trademarkRef, metaCID)"],
            ["Transfer (internal)", "Active SBT + PPOA sig + recipient SBT check", "internalTransfer(tokenId, toAddress)"],
            ["Encumber asset", "Administrator SBT + multi-sig", "encumberAsset(tokenId, encumbranceType, expiryBlock)"],
            ["Release encumbrance", "Ledger reconciliation confirmation", "releaseEncumbrance(tokenId, reconcileProof)"],
            ["Burn / retire", "Member SBT + PPOA sig + Admin counter-sign", "retireAsset(tokenId, retirementNote)"],
          ],
        },
      },
    ],
  },
  {
    id: "ledger",
    code: "§ 5.0",
    title: "Trust Account Number (TAN) & Ledger Engine",
    subsections: [
      {
        id: "5.1",
        title: "TAN Structure",
        content: `The Trust Account Number is the canonical identifier linking a member's identity, assets, and ledger obligations. Format:

    PMA-[CHAIN_PREFIX]-[MEMBER_SEQ_HEX]-[CHECKSUM]
    Example: PMA-0001-A4F3C2-7E

Generated deterministically at SBT issuance: keccak256(memberAddress + issuedAt + chainId), truncated and formatted. The TAN is immutable for the life of the membership and survives key rotation (wallet migration via admin-authorized re-binding).`,
      },
      {
        id: "5.2",
        title: "Ledger Smart Contract",
        content: `The ledger contract implements double-entry bookkeeping on-chain. Every entry requires a debit account, credit account, amount (uint256, 18 decimals), a memo hash (keccak256 of memo text), and a PPOA session proof. Entries are immutable once confirmed; corrections are applied as reversing entries per standard accounting practice.`,
        code: `struct LedgerEntry {
    uint256  entryId;
    bytes32  tanId;          // member's Trust Account Number
    address  authorizedBy;  // wallet that signed PPOA session
    uint256  debitAccount;  // Chart of Accounts code
    uint256  creditAccount;
    uint256  amount;        // 18-decimal fixed point
    bytes32  memoHash;      // keccak256(memo string)
    uint256  timestamp;
    bool     reversed;
}

mapping(bytes32 => LedgerEntry[]) public ledgerByTAN;

function postEntry(
    bytes32        _tanId,
    uint256        _debit,
    uint256        _credit,
    uint256        _amount,
    bytes32        _memoHash,
    PPOASessionProof calldata _proof
) external {
    _verifyPPOASession(_proof);          // reverts if invalid/expired
    _verifyTANOwnership(_tanId, msg.sender);
    uint256 entryId = ledgerByTAN[_tanId].length;
    ledgerByTAN[_tanId].push(LedgerEntry({
        entryId:      entryId,
        tanId:        _tanId,
        authorizedBy: msg.sender,
        debitAccount: _debit,
        creditAccount: _credit,
        amount:       _amount,
        memoHash:     _memoHash,
        timestamp:    block.timestamp,
        reversed:     false
    }));
    emit EntryPosted(_tanId, entryId, _debit, _credit, _amount);
}`,
      },
      {
        id: "5.3",
        title: "Reconciliation Workflow",
        content: null,
        table: {
          headers: ["Step", "Actor", "Action"],
          rows: [
            ["1 — Open Reconciliation", "Member", "Initiates reconcileRequest(tanId, period) from terminal"],
            ["2 — Ledger Snapshot", "Contract", "Emits snapshot of all unreconciled entries for the period"],
            ["3 — Member Review", "Member", "Reviews entries in terminal; flags disputes via disputeEntry(entryId, reason)"],
            ["4 — Admin Resolution", "Administrator SBT", "Resolves disputes; posts reversing entries if upheld"],
            ["5 — Close Reconciliation", "Member + Admin", "Both sign closeReconciliation(tanId, period); state sealed on-chain"],
            ["6 — Confirmation Receipt", "System", "IPFS-pinned reconciliation report issued; CID stored in TAN record"],
          ],
        },
      },
    ],
  },
  {
    id: "terminal",
    code: "§ 6.0",
    title: "Member Terminal — UI Specification",
    subsections: [
      {
        id: "6.1",
        title: "Authentication Flow",
        content: `1. Wallet connection (MetaMask / WalletConnect)
2. SBT presence check — contract call to balanceOf(connectedAddress)
3. SBT status check — memberRecords[address].revoked must be false
4. PPOA session signature — EIP-712 typed data sign (§ 3.2)
5. Session stored in memory only (never localStorage); expires per PPOA expiry field
6. All subsequent write operations re-verify session signature server-side before forwarding to contract`,
      },
      {
        id: "6.2",
        title: "Terminal Module Map",
        content: null,
        table: {
          headers: ["Module", "Route", "Access Tier", "Key Functions"],
          rows: [
            ["Dashboard", "/terminal", "All active members", "TAN summary, recent entries, asset count, alerts"],
            ["Identity Vault", "/terminal/identity", "All active members", "SBT details, PPOA status, key rotation request"],
            ["Asset Registry", "/terminal/assets", "Member + Admin", "Mint, view, transfer, encumber, retire trademark assets"],
            ["Ledger Console", "/terminal/ledger", "Member + Admin", "Post entries, view history, initiate reconciliation"],
            ["Reconciliation", "/terminal/reconcile", "Member + Admin", "Period-select, entry review, dispute, close & seal"],
            ["Admin Panel", "/terminal/admin", "Administrator only", "Issue/revoke SBTs, resolve disputes, view all TANs"],
            ["Document Archive", "/terminal/archive", "All active members", "Upload/download encrypted docs, IPFS pin manager"],
          ],
        },
      },
      {
        id: "6.3",
        title: "Security Constraints",
        content: `• All RPC calls route through the Association's private node; no public RPC endpoints
• Session tokens are ephemeral (memory-only); page refresh requires re-authentication  
• Write operations display a pre-flight summary requiring explicit member confirmation
• Rate limiting: 30 write transactions per TAN per rolling 24h window
• Anomaly detection: consecutive failed PPOA verifications trigger automatic session lockout and admin alert
• Audit log: every terminal action (read + write) is logged with wallet, timestamp, module, and action type; logs are append-only and IPFS-pinned nightly`,
      },
    ],
  },
  {
    id: "deployment",
    code: "§ 7.0",
    title: "Deployment & Infrastructure",
    subsections: [
      {
        id: "7.1",
        title: "Network Topology",
        content: null,
        table: {
          headers: ["Component", "Technology", "Notes"],
          rows: [
            ["Private Chain", "Hyperledger Besu (PoA / QBFT)", "Permissioned validator set; members are not validators"],
            ["Node Access", "JSON-RPC over TLS, auth-token gated", "No public endpoint exposure"],
            ["IPFS Cluster", "Private IPFS + Filecoin deals", "AES-256 at rest; member-key envelope"],
            ["Terminal Hosting", "Self-hosted / Tor hidden service optional", "No CDN; no third-party asset loading"],
            ["Key Management", "Member-controlled wallets only", "Association holds no private keys"],
            ["Contract Upgrades", "Transparent proxy + 5-of-7 multi-sig timelock", "72h delay on all upgrades"],
          ],
        },
      },
      {
        id: "7.2",
        title: "Contract Deployment Sequence",
        content: `1. Deploy PMA_SBT.sol → record address as SBT_ADDRESS
2. Deploy PMA_AssetRegistry.sol(SBT_ADDRESS) 
3. Deploy PMA_LedgerEngine.sol(SBT_ADDRESS, ASSET_REGISTRY_ADDRESS)
4. Grant ISSUER_ROLE on SBT contract to Association's issuer multisig
5. Grant LEDGER_WRITER_ROLE on LedgerEngine to AssetRegistry (for encumbrance entries)
6. Verify all contracts on private block explorer
7. Seed initial chart-of-accounts in LedgerEngine
8. Issue founding member SBTs via issuer multisig`,
      },
    ],
  },
];

const TIER_COLOR = {
  "§ 1.0": "#b8a07a",
  "§ 2.0": "#7ab8a0",
  "§3.0": "#a07ab8",
  "§ 4.0": "#7a9eb8",
  "§ 5.0": "#b87a7a",
  "§ 6.0": "#b8b07a",
  "§ 7.0": "#7ab87a",
};

function AccentBar({ code }) {
  const colors = ["#c9a96e","#6eb8a9","#a96ec9","#6e9ec9","#c96e6e","#c9c36e","#6ec96e"];
  const idx = parseInt(code.replace("§ ","").replace(".0","")) - 1;
  return <div style={{ width: 3, background: colors[idx % colors.length], borderRadius: 2, flexShrink: 0 }} />;
}

function CodeBlock({ code }) {
  return (
    <div style={{
      background: "#0a0c0f",
      border: "1px solid #1e2530",
      borderRadius: 6,
      padding: "16px 20px",
      marginTop: 16,
      fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
      fontSize: 11.5,
      lineHeight: 1.7,
      color: "#7ec8a4",
      overflowX: "auto",
      whiteSpace: "pre",
      letterSpacing: "0.02em",
    }}>
      {code}
    </div>
  );
}

function DataTable({ table }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th key={i} style={{
                textAlign: "left",
                padding: "8px 14px",
                background: "#111418",
                color: "#c9a96e",
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                borderBottom: "1px solid #2a3040",
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "#0d1018" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "9px 14px",
                  color: ci === 0 ? "#e8dfc8" : "#8a9ab0",
                  fontFamily: ci === 0 ? "'IBM Plex Mono', monospace" : "inherit",
                  fontSize: ci === 0 ? 12 : 13,
                  borderBottom: "1px solid #181d26",
                  lineHeight: 1.5,
                  verticalAlign: "top",
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ section, isActive, onToggle }) {
  const colors = ["#c9a96e","#6eb8a9","#a96ec9","#6e9ec9","#c96e6e","#c9c36e","#6ec96e"];
  const idx = parseInt(section.code.replace("§ ","").replace(".0","")) - 1;
  const accent = colors[idx % colors.length];

  return (
    <div style={{
      border: `1px solid ${isActive ? accent + "55" : "#1e2530"}`,
      borderRadius: 8,
      marginBottom: 12,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          background: isActive ? "#0f1318" : "#0b0e13",
          border: "none",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: accent,
          letterSpacing: "0.15em",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}>{section.code}</span>
        <span style