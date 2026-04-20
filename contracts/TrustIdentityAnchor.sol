// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TrustIdentityAnchor Contract
 * @dev This contract manages trademarks with IPFS integration, role-based access control,
 *      pausable functionality, and reentrancy protection.
 */
contract TrustIdentityAnchor is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");

    // Struct to hold trademark information
    struct Trademark {
        string regNum;  // Trademark registration number
        string ipfsHash; // IPFS hash for trademark data
        address owner;   // Owner of the trademark
    }

    // Mapping to store trademarks
    mapping(string => Trademark) private trademarks;

    /**
     * @dev Emitted when a trademark is registered.
     * @param regNum The trademark registration number.
     * @param ipfsHash The IPFS hash of the trademark file.
     */
    event TrademarkRegistered(string indexed regNum, string ipfsHash);

    /**
     * @dev Constructor that grants ADMIN_ROLE to the deployer.
     */
    constructor() {
        _setupRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Function to register a trademark.
     * @param regNum The trademark registration number.
     * @param ipfsHash The IPFS hash for storing trademark details.
     */
    function registerTrademark(string memory regNum, string memory ipfsHash) public onlyRole(USER_ROLE) whenNotPaused nonReentrant {
        require(trademarks[regNum].owner == address(0), "Trademark already registered.");
        trademarks[regNum] = Trademark(regNum, ipfsHash, msg.sender);
        emit TrademarkRegistered(regNum, ipfsHash);
    }

    /**
     * @dev Function to pause contract operations.
     * Can only be called by an ADMIN.
     */
    function pause() public onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Function to unpause contract operations.
     * Can only be called by an ADMIN.
     */
    function unpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Function to get trademark information.
     * @param regNum The trademark registration number.
     * @return The trademark details including registration number, IPFS hash, and owner address.
     */
    function getTrademark(string memory regNum) public view returns (Trademark memory) {
        return trademarks[regNum];
    }
}