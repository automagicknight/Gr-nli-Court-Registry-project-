import { useState } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const ACCENT_PALETTE = [
  "#c9a96e", // gold
  "#6eb8a9", // teal
  "#a96ec9", // violet
  "#6e9ec9", // steel blue
  "#c96e6e", // rose
  "#c9c36e", // amber
  "#6ec96e", // sage
  "#c97e4e", // copper
  "#7e9ec9", // slate
];

const sections = [
  // ── Previously built sections (collapsed summary entries) ──────────────────
  {
    id: "prev-sbt",
    code: "§ 1–7",
    title: "Core PMA Utility (Prior Spec)",
    summary: "Soulbound NFT credential, Private Power of Attorney anchoring, ERC-721 asset registry, double-entry ledger engine, member terminal, and Hyperledger Besu deployment. See Rev 1.0.",
    subsections: [],
    isPrior: true,
  },

  // ── NEW SECTIONS ───────────────────────────────────────────────────────────
  {
    id: "identity-anchor",
    code: "§ 8.0",
    title: "Trademark as Primary Identity Anchor",
    subsections: [
      {
        id: "8.1",
        title: "Conceptual Model",
        content: `Within the private Hyperledger Besu subnet, the pre-existing Trademark serves as the immutable root identity for the Trust. This is analogous to a self-sovereign DID (Decentralized Identifier) where the trademark registration number functions as the method-specific identifier — not as a public GLEIF LEI, but as the private network's canonical anchor.

The trademark predating all secondary registrations by ≥9 months establishes temporal priority. This priority is captured on-chain at genesis and referenced in every subsequent identity assertion within the private network.`,
      },
      {
        id: "8.2",
        title: "On-Chain Identity Anchor Contract",
        content: `The TrustIdentityAnchor contract registers the trademark at deployment. All subsequent identity-dependent contracts (SBT, AssetRegistry, LedgerEngine) reference this anchor, creating a single root of trust for the entire private network.`,
        code: `// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.20;

/// @title  TrustIdentityAnchor
/// @notice Registers a pre-existing Trademark as the immutable
///         primary identity anchor for the Private Trust on this subnet.
contract TrustIdentityAnchor {

    // ── Trademark Record ──────────────────────────────────────────
    struct TrademarkAnchor {
        string  registrationNumber;   // e.g. "NO-2024-XXXXXX"
        string  jurisdiction;         // ISO 3166-1 alpha-2, e.g. "NO"
        uint256 registrationDate;     // Unix timestamp
        string  trademarkName;        // e.g. "HOUSE OF GRØNLI"
        string  wipo_ref;             // WIPO Madrid ref, if applicable
        bytes32 certificateCID;       // keccak256(IPFS CID of cert PDF)
        bool    anchored;
    }

    TrademarkAnchor public anchor;
    address         public immutable trustee;
    uint256         public immutable anchoredAt;

    // Downstream contracts that depend on this anchor
    mapping(address => bool) public authorizedConsumers;

    event AnchorEstablished(
        string  registrationNumber,
        string  jurisdiction,
        uint256 registrationDate,
        bytes32 certificateCID
    );

    modifier onlyTrustee() {
        require(msg.sender == trustee, "Anchor: not trustee");
        _;
    }

    constructor(
        string  memory _regNumber,
        string  memory _jurisdiction,
        uint256        _regDate,
        string  memory _name,
        string  memory _wipoRef,
        bytes32        _certCID
    ) {
        require(_regDate < block.timestamp, "Anchor: reg date must be past");
        trustee = msg.sender;
        anchor  = TrademarkAnchor({
            registrationNumber: _regNumber,
            jurisdiction:       _jurisdiction,
            registrationDate:   _regDate,
            trademarkName:      _name,
            wipo_ref:           _wipoRef,
            certificateCID:     _certCID,
            anchored:           true
        });
        anchoredAt = block.timestamp;
        emit AnchorEstablished(_regNumber, _jurisdiction, _regDate, _certCID);
    }

    /// @notice Returns the priority gap in seconds between trademark
    ///         registration and any comparison date (e.g. SPV formation date).
    function priorityGap(uint256 _comparisonDate)
        external view returns (uint256 gap, bool issenior)
    {
        require(_comparisonDate > anchor.registrationDate, "Anchor: comparison must be later");
        gap      = _comparisonDate - anchor.registrationDate;
        issenior = gap >= 270 days; // 9-month threshold
    }

    function authorizeConsumer(address _contract) external onlyTrustee {
        authorizedConsumers[_contract] = true;
    }

    function verifyAnchor() external view returns (bool) {
        return anchor.anchored;
    }
}`,
      },
      {
        id: "8.3",
        title: "DID Document Mapping",
        content: `The trademark anchor is expressed as a W3C-compatible DID document for interoperability with verifiable credential frameworks used by the member terminal. The DID method is did:pma: (private, not registered with W3C).`,
        code: `// DID Document generated at anchor deployment (stored on private IPFS)
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:pma:NO-2024-XXXXXX",
  "alsoKnownAs": ["trademark:NO:NO-2024-XXXXXX"],

  "verificationMethod": [{
    "id":           "did:pma:NO-2024-XXXXXX#trustee-key-1",
    "type":         "Ed25519VerificationKey2020",
    "controller":   "did:pma:NO-2024-XXXXXX",
    "publicKeyMultibase": "<trustee-ed25519-pubkey>"
  }],

  "authentication":  ["did:pma:NO-2024-XXXXXX#trustee-key-1"],
  "assertionMethod": ["did:pma:NO-2024-XXXXXX#trustee-key-1"],

  "service": [{
    "id":              "did:pma:NO-2024-XXXXXX#ledger",
    "type":            "PMALedgerEndpoint",
    "serviceEndpoint": "besu://private-node/ledger"
  }],

  // Private extension — not for public DID resolution
  "pmaExtension": {
    "trademarkRegistration": "NO-2024-XXXXXX",
    "jurisdiction":          "NO",
    "registrationDate":      "2024-MM-DD",
    "seniorLienHolder":      "Kim Terje Rudschinat Grønli, Trustee",
    "trustAccountNumber":    "PMA-0001-A4F3C2-7E",
    "anchorContractAddress": "0x..."
  }
}`,
      },
    ],
  },

  {
    id: "iso20022",
    code: "§ 9.0",
    title: "ISO 20022 Private Ledger Metadata Mapping",
    subsections: [
      {
        id: "9.1",
        title: "Architecture: Private Middleware Layer",
        content: `The ISO 20022 mapping operates exclusively as internal middleware within the private clearinghouse. It transforms on-chain ledger state into ISO 20022-structured XML envelopes for member-to-member settlement messages. These messages never touch a public clearinghouse (SWIFT, SEPA) unless a member explicitly initiates an outbound gateway transaction — at which point standard public-network identity credentials (actual LEI, IBAN) replace the private identifiers.

Layer model:
  [On-chain Ledger State] → [PMA Middleware Transformer] → [ISO 20022 XML Envelope]
  → [Private Settlement Bus] → [Recipient Member Terminal]
  
  If outbound: → [Gateway Adapter] → [Public Network] (with real LEI/IBAN substituted)`,
      },
      {
        id: "9.2",
        title: "Field Mapping Table",
        content: null,
        table: {
          headers: ["ISO 20022 Field", "XML Tag", "Private Ledger Source", "Example Value"],
          rows: [
            ["Party Identification", "<PtyId>", "TrustIdentityAnchor.anchor.registrationNumber + jurisdiction + date", "TM:NO-2024-XXXXXX:NO:2024-MM-DD"],
            ["Name", "<Nm>", "TrustIdentityAnchor.anchor.trademarkName", "HOUSE OF GRØNLI TRUST"],
            ["In Care Of", "<CareOf>", "SBT.memberRecords[trusteeAddr].tier + trustee name", "Kim Terje Rudschinat Grønli, Trustee"],
            ["Role of Party", "<Role>", "Hardcoded per message type", "SeniorSecuredParty | LienHolder | Trustee"],
            ["Account ID", "<Acct><Id>", "LedgerEngine TAN", "PMA-0001-A4F3C2-7E"],
            ["IBAN / Proprietary", "<Othr><Id>", "TAN (proprietary scheme = PMA_TAN)", "PMA_TAN:PMA-0001-A4F3C2-7E"],
            ["Document Reference", "<Doc><Ref>", "IPFS CID of PPOA or UCC analog", "ipfs:bafybeig..."],
            ["Address", "<Adr><StrtNm>", "Trust registered address", "Grønli Administrative Record, Norway"],
            ["Lien Reference", "<Refs><InstrId>", "keccak256(anchorContract + TAN + entryId)", "0xabcd...1234"],
          ],
        },
      },
      {
        id: "9.3",
        title: "pacs.008 — Private Credit Transfer XML Template",
        content: `Sample pacs.008 (FIToFICustomerCreditTransfer) repurposed as a private member-to-member settlement instruction. All identifiers are internal PMA scheme values.`,
        code: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10"
          xmlns:pma="urn:pma:private:ext:1.0">

  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>PMA-MSG-20260415-001</MsgId>
      <CreDtTm>2026-04-15T10:00:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>INDA</SttlmMtd>           <!-- Internal settlement -->
        <SttlmAcct>
          <Id><Othr>
            <Id>PMA-CLEARINGHOUSE-001</Id>
            <SchmeNm><Prtry>PMA_TAN</Prtry></SchmeNm>
          </Othr></Id>
        </SttlmAcct>
      </SttlmInf>
    </GrpHdr>

    <CdtTrfTxInf>
      <PmtId>
        <InstrId>PMA-INSTR-20260415-001</InstrId>
        <EndToEndId>PMA-E2E-20260415-001</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="NOK">50000.00</IntrBkSttlmAmt>

      <!-- ── DEBTOR (Sending Member) ─────────────────────── -->
      <Dbtr>
        <Nm>HOUSE OF GRØNLI TRUST</Nm>
        <PstlAdr>
          <Ctry>NO</Ctry>
          <AdrLine>Grønli Administrative Record</AdrLine>
        </PstlAdr>
        <Id><OrgId><Othr>
          <Id>TM:NO-2024-XXXXXX:NO:2024-MM-DD</Id>
          <SchmeNm><Prtry>PMA_TRADEMARK_ANCHOR</Prtry></SchmeNm>
        </Othr></OrgId></Id>
      </Dbtr>

      <DbtrAcct><Id><Othr>
        <Id>PMA-0001-A4F3C2-7E</Id>
        <SchmeNm><Prtry>PMA_TAN</Prtry></SchmeNm>
      </Othr></Id></DbtrAcct>

      <!-- ── C/O EXTENSION (Senior Lien Holder) ────────────── -->
      <pma:CareOf>
        <pma:LienHolderNm>Kim Terje Rudschinat Grønli</pma:LienHolderNm>
        <pma:Capacity>Trustee</pma:Capacity>
        <pma:Role>SeniorSecuredParty</pma:Role>
        <pma:PPOARef>ipfs:bafybeig...</pma:PPOARef>
        <pma:SBTTokenId>0xSBT_TOKEN_ID</pma:SBTTokenId>
        <pma:AnchorContract>0xANCHOR_CONTRACT_ADDR</pma:AnchorContract>
      </pma:CareOf>

      <!-- ── CREDITOR (Receiving Member) ────────────────────── -->
      <Cdtr>
        <Nm>RECIPIENT MEMBER TRUST</Nm>
        <Id><OrgId><Othr>
          <Id>PMA-0002-B7D1E4-3F</Id>
          <SchmeNm><Prtry>PMA_TAN</Prtry></SchmeNm>
        </Othr></OrgId></Id>
      </Cdtr>

      <CdtrAcct><Id><Othr>
        <Id>PMA-0002-B7D1E4-3F</Id>
        <SchmeNm><Prtry>PMA_TAN</Prtry></SchmeNm>
      </Othr></Id></CdtrAcct>

      <!-- ── DOCUMENT / LIEN REFERENCE ──────────────────────── -->
      <RltdRmtInf><RmtId>
        <Tp><CdOrPrtry><Prtry>PMA_LIEN_REF</Prtry></CdOrPrtry></Tp>
        <Ref>0xLEDGER_ENTRY_HASH</Ref>
      </RmtId></RltdRmtInf>

    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
      },
      {
        id: "9.4",
        title: "camt.053 — Private Account Statement Template",
        content: `camt.053 (BankToCustomerStatement) repurposed as a TAN ledger statement for member reconciliation. Emitted by the LedgerEngine after each reconciliation cycle close.`,
        code: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.10"
          xmlns:pma="urn:pma:private:ext:1.0">
  <BkToCstmrStmt>
    <GrpHdr>
      <MsgId>PMA-STMT-20260415-TAN-0001</MsgId>
      <CreDtTm>2026-04-15T23:59:59</CreDtTm>
    </GrpHdr>
    <Stmt>
      <Id>STMT-Q1-2026-PMA-0001-A4F3C2-7E</Id>
      <ElctrncSeqNb>42</ElctrncSeqNb>
      <FrToDt>
        <FrDtTm>2026-01-01T00:00:00</FrDtTm>
        <ToDtTm>2026-03-31T23:59:59</ToDtTm>
      </FrToDt>

      <Acct>
        <Id><Othr>
          <Id>PMA-0001-A4F3C2-7E</Id>
          <SchmeNm><Prtry>PMA_TAN</Prtry></SchmeNm>
        </Othr></Id>
        <Ownr>
          <Nm>HOUSE OF GRØNLI TRUST</Nm>
          <Id><OrgId><Othr>
            <Id>TM:NO-2024-XXXXXX:NO:2024-MM-DD</Id>
            <SchmeNm><Prtry>PMA_TRADEMARK_ANCHOR</Prtry></SchmeNm>
          </Othr></OrgId></Id>
        </Ownr>
        <Svcr>
          <FinInstnId><Nm>PMA Private Clearinghouse</Nm></FinInstnId>
        </Svcr>
      </Acct>

      <!-- Opening / Closing Balance -->
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="NOK">100000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-01-01</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="NOK">148500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-03-31</Dt></Dt>
      </Bal>

      <!-- Sample Entry -->
      <Ntry>
        <Amt Ccy="NOK">50000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><Dt>2026-02-15</Dt></BookgDt>
        <ValDt><Dt>2026-02-15</Dt></ValDt>
        <NtryRef>PMA-ENTRY-00042</NtryRef>
        <BkTxCd><Prtry><Cd>PMA_SETTLEMENT</Cd></Prtry></BkTxCd>
        <NtryDtls><TxDtls>
          <Refs>
            <InstrId>PMA-INSTR-20260215-001</InstrId>
            <EndToEndId>PMA-E2E-20260215-001</EndToEndId>
          </Refs>
          <RltdPties>
            <Dbtr><Pty><Nm>COUNTERPARTY TRUST</Nm></Pty></Dbtr>
          </RltdPties>
          <RmtInf><Ustrd>Asset registry transfer — token 0xTKN...4321</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>

    </Stmt>
  </BkToCstmrStmt>
</Document>`,
      },
    ],
  },

  {
    id: "middleware",
    code: "§ 10.0",
    title: "ISO 20022 Transformer — Middleware Spec",
    subsections: [
      {
        id: "10.1",
        title: "Transformer Architecture",
        content: `The middleware transformer is a TypeScript service that subscribes to LedgerEngine events on the Besu node, maps on-chain state to ISO 20022 XML envelopes, validates against XSD schemas, and publishes to the private settlement bus (a permissioned message queue accessible only to member nodes).`,
        code: `// pma-iso20022-transformer/src/transformer.ts
import { ethers }    from "ethers";
import { create }    from "xmlbuilder2";
import { validate }  from "xsd-schema-validator";
import { ipfsPin }   from "./ipfs";

const PMA_SCHEME   = "PMA_TRADEMARK_ANCHOR";
const TAN_SCHEME   = "PMA_TAN";
const PMA_NS       = "urn:pma:private:ext:1.0";
const PACS008_NS   = "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10";

interface LedgerEntryEvent {
  tanId:         string;
  entryId:       bigint;
  debitAccount:  bigint;
  creditAccount: bigint;
  amount:        bigint;
  memoHash:      string;
  authorizedBy:  string;
  timestamp:     bigint;
}

interface TrustProfile {
  trademarkAnchorId: string;   // "TM:NO-2024-XXXXXX:NO:2024-MM-DD"
  trustName:         string;
  careOf:            string;
  capacity:          string;
  role:              string;
  ppoaCID:           string;
  sbtTokenId:        string;
  anchorContract:    string;
  tan:               string;
}

export function buildPacs008(
  entry:    LedgerEntryEvent,
  debtor:   TrustProfile,
  creditor: TrustProfile,
  currency: string = "NOK"
): string {
  const msgId  = \`PMA-MSG-\${Date.now()}-\${entry.entryId}\`;
  const amount = ethers.formatUnits(entry.amount, 18);

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("Document", { xmlns: PACS008_NS, "xmlns:pma": PMA_NS })
      .ele("FIToFICstmrCdtTrf")
        .ele("GrpHdr")
          .ele("MsgId").txt(msgId).up()
          .ele("CreDtTm").txt(new Date().toISOString()).up()
          .ele("NbOfTxs").txt("1").up()
          .ele("SttlmInf")
            .ele("SttlmMtd").txt("INDA").up()
            .ele("SttlmAcct").ele("Id").ele("Othr")
              .ele("Id").txt("PMA-CLEARINGHOUSE-001").up()
              .ele("SchmeNm").ele("Prtry").txt(TAN_SCHEME).up().up()
            .up().up().up()
          .up()
        .up()
        .ele("CdtTrfTxInf")
          .ele("PmtId")
            .ele("InstrId").txt(\`PMA-INSTR-\${entry.entryId}\`).up()
            .ele("EndToEndId").txt(\`PMA-E2E-\${entry.entryId}\`).up()
          .up()
          .ele("IntrBkSttlmAmt", { Ccy: currency }).txt(amount).up()
          // Debtor
          .ele("Dbtr")
            .ele("Nm").txt(debtor.trustName).up()
            .ele("Id").ele("OrgId").ele("Othr")
              .ele("Id").txt(debtor.trademarkAnchorId).up()
              .ele("SchmeNm").ele("Prtry").txt(PMA_SCHEME).up().up()
            .up().up().up()
          .up()
          .ele("DbtrAcct").ele("Id").ele("Othr")
            .ele("Id").txt(debtor.tan).up()
            .ele("SchmeNm").ele("Prtry").txt(TAN_SCHEME).up().up().up().up()
          // C/O Extension
          .ele("pma:CareOf")
            .ele("pma:LienHolderNm").txt(debtor.careOf).up()
            .ele("pma:Capacity").txt(debtor.capacity).up()
            .ele("pma:Role").txt(debtor.role).up()
            .ele("pma:PPOARef").txt(debtor.ppoaCID).up()
            .ele("pma:SBTTokenId").txt(debtor.sbtTokenId).up()
            .ele("pma:AnchorContract").txt(debtor.anchorContract).up()
          .up()
          // Creditor
          .ele("Cdtr")
            .ele("Nm").txt(creditor.trustName).up()
            .ele("Id").ele("OrgId").ele("Othr")
              .ele("Id").txt(creditor.tan).up()
              .ele("SchmeNm").ele("Prtry").txt(TAN_SCHEME).up().up().up().up()
          .up()
          .ele("CdtrAcct").ele("Id").ele("Othr")
            .ele("Id").txt(creditor.tan).up()
            .ele("SchmeNm").ele("Prtry").txt(TAN_SCHEME).up().up().up().up()
        .up()
      .up()
    .up();

  return doc.end({ prettyPrint: true });
}

// Subscriber — listens for on-chain entry events and emits XML
export async function startTransformer(
  provider:   ethers.Provider,
  ledgerAddr: string,
  ledgerABI:  ethers.InterfaceAbi
) {
  const ledger = new ethers.Contract(ledgerAddr, ledgerABI, provider);

  ledger.on("EntryPosted", async (tanId, entryId, debit, credit, amount, event) => {
    const [debtor, creditor] = await resolveProfiles(tanId, provider);
    const xml = buildPacs008(
      { tanId, entryId, debitAccount: debit, creditAccount: credit, amount,
        memoHash: "", authorizedBy: "", timestamp: BigInt(Date.now()) },
      debtor, creditor
    );
    await validate(xml, "./schemas/pacs.008.001.10.xsd"); // XSD validation
    const cid = await ipfsPin(xml);                        // Pin to private IPFS
    await publishToSettlementBus(xml, cid);                // Push to member queues
  });
}`,
      },
      {
        id: "10.2",
        title: "Gateway Adapter — Private-to-Public Bridge",
        content: `When a member initiates an outbound transaction to the public banking network, the Gateway Adapter replaces all private PMA identifiers with real public-network credentials. This ensures the internal schema never leaks into regulated financial messaging.`,
        table: {
          headers: ["Private Field", "Private Value", "Public Replacement", "Source"],
          rows: [
            ["PtyId scheme", "PMA_TRADEMARK_ANCHOR", "GLEIF LEI (if member holds one)", "Member KYC record"],
            ["Account ID scheme", "PMA_TAN", "IBAN / BBAN", "Member bank account record"],
            ["CareOf extension", "pma:CareOf block", "Stripped (not valid in public SWIFT)", "Gateway strips on egress"],
            ["Name", "HOUSE OF GRØNLI TRUST", "Legal registered name", "Member's public entity record"],
            ["Settlement method", "INDA (internal)", "CLRG or COVE", "Publ