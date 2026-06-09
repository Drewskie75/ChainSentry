// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainSentry
 * @dev Records and verifies SHA-256 forensic hashes of application crash telemetry.
 */
contract ChainSentry {
    // Address of the contract deployer / administrator
    address public owner;

    // Mapping from incident UUID/ObjectID string to its cryptographic forensic SHA-256 hash
    mapping(string => string) private incidentHashes;

    // Event emitted when a new telemetry incident is permanently anchored on-chain
    event IncidentRecorded(
        string indexed incidentId,
        string forensicHash,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Permanently records an incident hash on-chain.
     * @param incidentId Unique identifier string of the telemetry report.
     * @param forensicHash The computed SHA-256 hash of the crash logs & AI findings.
     */
    function recordIncident(
        string calldata incidentId,
        string calldata forensicHash
    ) external returns (bool) {
        // Enforce uniqueness - once written, forensic hashes cannot be overwritten to prevent tampering
        require(
            bytes(incidentHashes[incidentId]).length == 0,
            "ChainSentry: Incident hash already recorded on-chain"
        );
        require(
            bytes(forensicHash).length > 0,
            "ChainSentry: Forensic hash cannot be empty"
        );

        incidentHashes[incidentId] = forensicHash;

        emit IncidentRecorded(incidentId, forensicHash, block.timestamp);
        return true;
    }

    /**
     * @dev Retrieves the recorded hash for a given incident ID.
     * @param incidentId Unique identifier string of the telemetry report.
     * @return The SHA-256 hash associated with the incident.
     */
    function getIncidentHash(
        string calldata incidentId
    ) external view returns (string memory) {
        return incidentHashes[incidentId];
    }
}
