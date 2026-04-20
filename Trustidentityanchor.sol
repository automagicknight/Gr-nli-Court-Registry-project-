// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  TrustIdentityAnchor
 * @author House of Grønli ©™ PMA
 * @notice Genesis contract for the House of Grønli internal DAO system.
 *         Stores immutable metadata about the association's founding identity
 *         record. Acts as the single source of truth that all downstream
 *         contracts (SBT, AssetRegistry, LedgerEngine) reference for context.
 *
 * @dev    This contract is INTERNAL to the House of Grønli PMA.
 *         It makes no claims against external registries, banks, or
 *         third-party legal systems. It is a private database record.
 *
 *         Deployed on: Polygon Mainnet (chainId 137)
 *         Framework:   Aragon OSx DAO shell
 *         Contact:     linktree.com/polliville
 */
contract TrustIdentityAnchor is AccessControl, Pausable, ReentrancyGuard {

    // ─── Roles ────────────────────────────────────────────────────────────────

    /// @notice Can update mutable metadata fields (e.g. IPFS document CID).
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");

    /// @notice Can authorise downstream contracts to read from this anchor.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // ─── Data Structures ──────────────────────────────────────────────────────

    /**
     * @notice Immutable founding identity record.
     * @dev    Set once in the constructor. Fields marked `immutable` cannot
     *         be changed after deployment — this is intentional to provide
     *         a stable root for all downstream contracts.
     */
    struct IdentityRecord {
        /// Internal reference label (e.g. "HOUSE OF GRONLI")
        string  label;
        /// ISO 3166-1 alpha-2 jurisdiction code (e.g. "NO" for Norway)
        string  jurisdiction;
        /// Unix timestamp: when this internal record was formally established
        uint256 establishedAt;
        /// IPFS CID of the founding document package (encrypted, members only)
        string  documentCID;
        /// Arbitrary version tag for this record schema (e.g. "1.0")
        string  version;
    }

    /**
     * @notice Mutable metadata — can be updated by ADMIN_ROLE.
     * @dev    Stores CIDs that may be re-pinned, and operational flags.
     */
    struct MutableMetadata {
        /// IPFS CID of the latest internal operating rules document
        string  operatingRulesCID;
        /// IPFS CID of the latest membership register (encrypted)
        string  memberRegisterCID;
        /// Free-form notes for internal admin use
        string  adminNotes;
        /// Timestamp of last metadata update
        uint256 lastUpdated;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice The immutable founding identity record. Set in constructor.
    IdentityRecord public identityRecord;

    /// @notice Mutable operational metadata.
    MutableMetadata public metadata;

    /// @notice Block number when this contract was deployed.
    uint256 public immutable deployedAtBlock;

    /// @notice chainId captured at deployment — used by downstream contracts
    ///         to verify they are on the correct network.
    uint256 public immutable deployedOnChain;

    /// @notice Downstream contracts authorised to call verifyAnchor().
    mapping(address => bool) public authorisedConsumers;

    /// @notice Count of registered consumers — for iteration if needed.
    uint256 public consumerCount;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted once when the anchor is first established.
    event AnchorEstablished(
        string  label,
        string  jurisdiction,
        uint256 establishedAt,
        string  documentCID,
        uint256 blockNumber
    );

    /// @notice Emitted when mutable metadata is updated.
    event MetadataUpdated(
        string  field,
        string  newCID,
        address updatedBy,
        uint256 timestamp
    );

    /// @notice Emitted when a consumer contract is authorised.
    event ConsumerAuthorised(address indexed consumer, address authorisedBy);

    /// @notice Emitted when a consumer contract is revoked.
    event ConsumerRevoked(address indexed consumer, address revokedBy);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotAuthorisedConsumer(address caller);
    error AlreadyAuthorised(address consumer);
    error NotAuthorised(address consumer);
    error EmptyString(string field);
    error FutureTimestamp(uint256 provided, uint256 current);
    error ZeroAddress();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @notice Deploy the TrustIdentityAnchor.
     * @dev    The deployer receives DEFAULT_ADMIN_ROLE, ADMIN_ROLE, and
     *         MANAGER_ROLE. In production, DEFAULT_ADMIN_ROLE should be
     *         transferred to the Aragon DAO shell after deployment.
     *
     * @param _label          Internal name (e.g. "HOUSE OF GRONLI")
     * @param _jurisdiction   ISO 3166-1 alpha-2 code (e.g. "NO")
     * @param _establishedAt  Unix timestamp of formal establishment
     * @param _documentCID    IPFS CID of founding document package
     * @param _version        Schema version string (e.g. "1.0")
     */
    constructor(
        string memory _label,
        string memory _jurisdiction,
        uint256       _establishedAt,
        string memory _documentCID,
        string memory _version
    ) {
        // ── Input validation ──────────────────────────────────────────────────
        if (bytes(_label).length          == 0) revert EmptyString("label");
        if (bytes(_jurisdiction).length   == 0) revert EmptyString("jurisdiction");
        if (bytes(_documentCID).length    == 0) revert EmptyString("documentCID");
        if (bytes(_version).length        == 0) revert EmptyString("version");
        if (_establishedAt > block.timestamp)
            revert FutureTimestamp(_establishedAt, block.timestamp);

        // ── Set immutable identity record ─────────────────────────────────────
        identityRecord = IdentityRecord({
            label:          _label,
            jurisdiction:   _jurisdiction,
            establishedAt:  _establishedAt,
            documentCID:    _documentCID,
            version:        _version
        });

        deployedAtBlock  = block.number;
        deployedOnChain  = block.chainid;

        // ── Grant roles to deployer ───────────────────────────────────────────
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE,         msg.sender);
        _grantRole(MANAGER_ROLE,       msg.sender);

        emit AnchorEstablished(
            _label,
            _jurisdiction,
            _establishedAt,
            _documentCID,
            block.number
        );
    }

    // ─── Consumer Management ──────────────────────────────────────────────────

    /**
     * @notice Authorise a downstream contract (SBT, AssetRegistry, etc.)
     *         to call verifyAnchor().
     * @dev    Only MANAGER_ROLE. Emits ConsumerAuthorised.
     * @param _consumer Address of the downstream contract.
     */
    function authoriseConsumer(address _consumer)
        external
        onlyRole(MANAGER_ROLE)
    {
        if (_consumer == address(0))          revert ZeroAddress();
        if (authorisedConsumers[_consumer])   revert AlreadyAuthorised(_consumer);

        authorisedConsumers[_consumer] = true;
        consumerCount++;

        emit ConsumerAuthorised(_consumer, msg.sender);
    }

    /**
     * @notice Revoke a previously authorised consumer.
     * @param _consumer Address to revoke.
     */
    function revokeConsumer(address _consumer)
        external
        onlyRole(MANAGER_ROLE)
    {
        if (!authorisedConsumers[_consumer]) revert NotAuthorised(_consumer);

        authorisedConsumers[_consumer] = false;
        consumerCount--;

        emit ConsumerRevoked(_consumer, msg.sender);
    }

    // ─── Verification ─────────────────────────────────────────────────────────

    /**
     * @notice Called by downstream contracts to verify the anchor is live
     *         and they are authorised to use it.
     * @dev    Reverts if caller is not an authorised consumer, or if the
     *         contract is paused. Downstream constructors should call this.
     * @return label_          The internal identity label.
     * @return jurisdiction_   The jurisdiction code.
     * @return establishedAt_  The establishment timestamp.
     * @return chainId_        The chain this anchor was deployed on.
     */
    function verifyAnchor()
        external
        view
        whenNotPaused
        returns (
            string  memory label_,
            string  memory jurisdiction_,
            uint256        establishedAt_,
            uint256        chainId_
        )
    {
        if (!authorisedConsumers[msg.sender])
            revert NotAuthorisedConsumer(msg.sender);

        return (
            identityRecord.label,
            identityRecord.jurisdiction,
            identityRecord.establishedAt,
            deployedOnChain
        );
    }

    /**
     * @notice Public read — anyone can confirm the anchor exists and is live.
     *         Does not expose document CIDs.
     */
    function isLive() external view returns (bool) {
        return !paused() && bytes(identityRecord.label).length > 0;
    }

    /**
     * @notice Returns the age of this anchor in seconds.
     * @dev    Useful for downstream contracts to verify temporal ordering
     *         (e.g. "anchor must be older than X days before SPV is valid").
     */
    function anchorAgeSeconds() external view returns (uint256) {
        return block.timestamp - identityRecord.establishedAt;
    }

    // ─── Metadata Updates ─────────────────────────────────────────────────────

    /**
     * @notice Update the IPFS CID for the operating rules document.
     * @param _cid New IPFS CID string.
     */
    function updateOperatingRulesCID(string calldata _cid)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
    {
        if (bytes(_cid).length == 0) revert EmptyString("operatingRulesCID");
        metadata.operatingRulesCID = _cid;
        metadata.lastUpdated       = block.timestamp;
        emit MetadataUpdated("operatingRulesCID", _cid, msg.sender, block.timestamp);
    }

    /**
     * @notice Update the IPFS CID for the member register.
     * @param _cid New IPFS CID string.
     */
    function updateMemberRegisterCID(string calldata _cid)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
    {
        if (bytes(_cid).length == 0) revert EmptyString("memberRegisterCID");
        metadata.memberRegisterCID = _cid;
        metadata.lastUpdated       = block.timestamp;
        emit MetadataUpdated("memberRegisterCID", _cid, msg.sender, block.timestamp);
    }

    /**
     * @notice Update internal admin notes.
     * @param _notes Free-form string — stored on-chain, so keep short.
     */
    function updateAdminNotes(string calldata _notes)
        external
        onlyRole(ADMIN_ROLE)
    {
        metadata.adminNotes  = _notes;
        metadata.lastUpdated = block.timestamp;
    }

    // ─── Emergency Controls ───────────────────────────────────────────────────

    /// @notice Pause the anchor — blocks verifyAnchor() calls.
    function pause()   external onlyRole(ADMIN_ROLE) { _pause(); }

    /// @notice Unpause the anchor.
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns the full identity record as a tuple.
     */
    function getIdentityRecord()
        external
        view
        returns (IdentityRecord memory)
    {
        return identityRecord;
    }

    /**
     * @notice Returns the full mutable metadata as a tuple.
     */
    function getMutableMetadata()
        external
        view
        returns (MutableMetadata memory)
    {
        return metadata;
    }
}

