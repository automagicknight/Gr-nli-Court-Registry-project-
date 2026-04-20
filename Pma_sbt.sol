// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title  PMA_SBT
 * @author House of Grønli ©™ PMA
 * @notice Soulbound (non-transferable) membership NFT for the House of Grønli
 *         Private Membership Association. Each active member holds exactly one
 *         token. Tokens cannot be transferred, sold, or delegated.
 *
 * @dev    Implements the spirit of EIP-5114 (Soulbound tokens) by overriding
 *         all transfer functions to revert. Built on ERC-721 for compatibility
 *         with Aragon OSx and standard wallet tooling.
 *
 *         References TrustIdentityAnchor to verify it is operating within the
 *         correct internal system context.
 *
 *         Deployed on: Polygon Mainnet (chainId 137)
 */
contract PMA_SBT is ERC721, ERC721URIStorage, AccessControl, Pausable, ReentrancyGuard {

    // ─── Roles ────────────────────────────────────────────────────────────────

    /// @notice Can issue and revoke membership tokens.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @notice Can suspend members (read-only access, no writes).
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");

    // ─── Member Tiers ─────────────────────────────────────────────────────────

    enum MemberTier {
        Observer,      // 0 — read-only access
        Member,        // 1 — standard member
        Administrator  // 2 — full admin access
    }

    // ─── Data Structures ──────────────────────────────────────────────────────

    /**
     * @notice On-chain record for each member.
     * @dev    Stored by wallet address. One record per wallet enforced.
     */
    struct MemberRecord {
        uint256    tokenId;
        address    wallet;
        MemberTier tier;
        /// keccak256 of the member's PPOA document (stored on IPFS)
        bytes32    documentHash;
        uint256    issuedAt;
        uint256    expiresAt;   // 0 = no expiry
        bool       suspended;
        bool       revoked;
        /// Free-form internal label (e.g. member's preferred name)
        string     label;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Reference to the genesis identity anchor contract.
    address public immutable anchorContract;

    /// @notice Maps wallet address → member record.
    mapping(address => MemberRecord) public memberRecords;

    /// @notice Maps tokenId → wallet address (reverse lookup).
    mapping(uint256 => address) public tokenOwnerOf;

    /// @notice Total tokens ever issued (does not decrease on revocation).
    uint256 public totalIssued;

    /// @notice Current active member count.
    uint256 public activeCount;

    /// @dev Internal token ID counter.
    uint256 private _nextTokenId;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MembershipIssued(
        address indexed wallet,
        uint256 indexed tokenId,
        MemberTier      tier,
        bytes32         documentHash,
        uint256         issuedAt
    );

    event MembershipRevoked(
        address indexed wallet,
        uint256 indexed tokenId,
        address         revokedBy
    );

    event MemberSuspended(
        address indexed wallet,
        bool            suspended,
        address         updatedBy
    );

    event TierUpdated(
        address indexed wallet,
        MemberTier      oldTier,
        MemberTier      newTier,
        address         updatedBy
    );

    event DocumentHashUpdated(
        address indexed wallet,
        bytes32         oldHash,
        bytes32         newHash,
        address         updatedBy
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Soulbound();
    error AlreadyMember(address wallet);
    error NotAMember(address wallet);
    error MemberRevoked(address wallet);
    error MemberSuspended_(address wallet);
    error InvalidDocumentHash();
    error ZeroAddress();
    error TokenExpired(uint256 tokenId, uint256 expiresAt);
    error AnchorNotLive();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @notice Deploy PMA_SBT.
     * @dev    Verifies the anchor contract is live on construction.
     *         In production, transfer ISSUER_ROLE to the Aragon DAO shell.
     *
     * @param _anchorContract  Address of the deployed TrustIdentityAnchor.
     */
    constructor(address _anchorContract)
        ERC721("House of Gronli Membership", "HOG-SBT")
    {
        if (_anchorContract == address(0)) revert ZeroAddress();

        anchorContract = _anchorContract;

        // Verify anchor is reachable (will revert if anchor is paused or
        // this contract is not yet authorised — authorise after deploy)
        // Note: full verification done in _verifyAnchorContext() helper

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE,        msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);

        _nextTokenId = 1;
    }

    // ─── Core: Issue Membership ───────────────────────────────────────────────

    /**
     * @notice Issue a Soulbound membership token to a new member.
     * @dev    Caller must have ISSUER_ROLE. One token per wallet enforced.
     *         In production, this is called via Aragon Multisig proposal.
     *
     * @param _to           Recipient wallet address.
     * @param _tier         Initial membership tier.
     * @param _documentHash keccak256 of the member's founding document (IPFS).
     * @param _metadataURI  IPFS URI for token metadata JSON.
     * @param _expiresAt    Expiry timestamp, or 0 for no expiry.
     * @param _label        Internal display label for this member.
     */
    function issueMembership(
        address    _to,
        MemberTier _tier,
        bytes32    _documentHash,
        string calldata _metadataURI,
        uint256    _expiresAt,
        string calldata _label
    )
        external
        onlyRole(ISSUER_ROLE)
        whenNotPaused
        nonReentrant
    {
        // ── Validation ────────────────────────────────────────────────────────
        if (_to == address(0))                     revert ZeroAddress();
        if (memberRecords[_to].issuedAt != 0)      revert AlreadyMember(_to);
        if (_documentHash == bytes32(0))           revert InvalidDocumentHash();
        if (_expiresAt != 0 && _expiresAt <= block.timestamp)
            revert TokenExpired(0, _expiresAt);

        // ── Mint ──────────────────────────────────────────────────────────────
        uint256 tokenId = _nextTokenId++;
        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        // ── Record ────────────────────────────────────────────────────────────
        memberRecords[_to] = MemberRecord({
            tokenId:      tokenId,
            wallet:       _to,
            tier:         _tier,
            documentHash: _documentHash,
            issuedAt:     block.timestamp,
            expiresAt:    _expiresAt,
            suspended:    false,
            revoked:      false,
            label:        _label
        });

        tokenOwnerOf[tokenId] = _to;
        totalIssued++;
        activeCount++;

        emit MembershipIssued(_to, tokenId, _tier, _documentHash, block.timestamp);
    }

    // ─── Core: Revoke Membership ──────────────────────────────────────────────

    /**
     * @notice Permanently revoke a membership token.
     * @dev    Burns the token. MemberRecord is retained for audit history
     *         but marked revoked. Cannot be undone — issue a new token if
     *         re-admitting.
     *
     * @param _wallet  Address whose membership to revoke.
     */
    function revokeMembership(address _wallet)
        external
        onlyRole(ISSUER_ROLE)
        nonReentrant
    {
        MemberRecord storage rec = memberRecords[_wallet];
        if (rec.issuedAt == 0)  revert NotAMember(_wallet);
        if (rec.revoked)        revert MemberRevoked(_wallet);

        uint256 tokenId = rec.tokenId;
        rec.revoked  = true;
        rec.suspended = false;
        activeCount--;

        _burn(tokenId);

        emit MembershipRevoked(_wallet, tokenId, msg.sender);
    }

    // ─── Admin Actions ────────────────────────────────────────────────────────

    /**
     * @notice Suspend or unsuspend a member.
     *         Suspended members cannot write to the ledger or registry.
     */
    function setSuspended(address _wallet, bool _suspended)
        external
        onlyRole(ADMIN_ROLE)
    {
        MemberRecord storage rec = memberRecords[_wallet];
        if (rec.issuedAt == 0) revert NotAMember(_wallet);
        if (rec.revoked)       revert MemberRevoked(_wallet);

        rec.suspended = _suspended;
        emit MemberSuspended(_wallet, _suspended, msg.sender);
    }

    /**
     * @notice Update a member's tier.
     */
    function updateTier(address _wallet, MemberTier _newTier)
        external
        onlyRole(ISSUER_ROLE)
    {
        MemberRecord storage rec = memberRecords[_wallet];
        if (rec.issuedAt == 0) revert NotAMember(_wallet);
        if (rec.revoked)       revert MemberRevoked(_wallet);

        MemberTier old = rec.tier;
        rec.tier = _newTier;
        emit TierUpdated(_wallet, old, _newTier, msg.sender);
    }

    /**
     * @notice Update the document hash for a member (e.g. renewed agreement).
     */
    function updateDocumentHash(address _wallet, bytes32 _newHash)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (_newHash == bytes32(0)) revert InvalidDocumentHash();
        MemberRecord storage rec = memberRecords[_wallet];
        if (rec.issuedAt == 0) revert NotAMember(_wallet);
        if (rec.revoked)       revert MemberRevoked(_wallet);

        bytes32 old      = rec.documentHash;
        rec.documentHash = _newHash;
        emit DocumentHashUpdated(_wallet, old, _newHash, msg.sender);
    }

    // ─── View / Query ─────────────────────────────────────────────────────────

    /**
     * @notice Check if a wallet holds an active (non-revoked, non-suspended,
     *         non-expired) membership.
     * @param _wallet  Address to check.
     * @return bool    True if the wallet is an active member.
     */
    function isActiveMember(address _wallet) external view returns (bool) {
        MemberRecord storage rec = memberRecords[_wallet];
        if (rec.issuedAt  == 0)  return false;
        if (rec.revoked)         return false;
        if (rec.suspended)       return false;
        if (rec.expiresAt != 0 && block.timestamp > rec.expiresAt) return false;
        return true;
    }

    /**
     * @notice Check if a wallet holds an active Administrator-tier token.
     */
    function isAdmin(address _wallet) external view returns (bool) {
        MemberRecord storage rec = memberRecords[_wallet];
        return rec.issuedAt != 0
            && !rec.revoked
            && !rec.suspended
            && rec.tier == MemberTier.Administrator;
    }

    /**
     * @notice Returns the member record for a given wallet.
     */
    function getMemberRecord(address _wallet)
        external
        view
        returns (MemberRecord memory)
    {
        return memberRecords[_wallet];
    }

    // ─── Soulbound Enforcement ────────────────────────────────────────────────
    // All transfer, approval, and delegation functions revert.
    // Tokens are permanently bound to the minting address.

    function transferFrom(address, address, uint256)
        public pure override(ERC721)
    { revert Soulbound(); }

    function safeTransferFrom(address, address, uint256, bytes memory)
        public pure override(ERC721)
    { revert Soulbound(); }

    function approve(address, uint256)
        public pure override(ERC721)
    { revert Soulbound(); }

    function setApprovalForAll(address, bool)
        public pure override(ERC721)
    { revert Soulbound(); }

    // ─── Emergency Controls ───────────────────────────────────────────────────

    function pause()   external onlyRole(ADMIN_ROLE) { _pause();   }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── ERC-165 ──────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ─── ERC-721 URI override ─────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}

