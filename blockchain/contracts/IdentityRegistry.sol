
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract IdentityRegistry {
    struct Identity {
        bytes32 identityHash;
        string did;
        string publicKey;
        uint256 createdAt;
        bool active;
    }

    // Each identity is indexed by its unique hash.
    mapping(bytes32 => Identity) private identities;

    event IdentityRegistered(
        address indexed registrar,
        bytes32 indexed identityHash,
        string did,
        uint256 createdAt
    );

    event IdentityDeactivated(
        bytes32 indexed identityHash,
        address indexed registrar,
        uint256 timestamp
    );

    function registerIdentity(
        bytes32 identityHash,
        string memory did,
        string memory publicKey
    ) public {
        require(identityHash != bytes32(0), "Invalid identity hash");
        require(bytes(did).length > 0, "DID is required");
        require(bytes(publicKey).length > 0, "Public key is required");
        require(
            identities[identityHash].createdAt == 0,
            "Identity already registered"
        );

        identities[identityHash] = Identity({
            identityHash: identityHash,
            did: did,
            publicKey: publicKey,
            createdAt: block.timestamp,
            active: true
        });

        emit IdentityRegistered(
            msg.sender,
            identityHash,
            did,
            block.timestamp
        );
    }

    function getIdentity(
        bytes32 identityHash
    )
        public
        view
        returns (
            bytes32 storedHash,
            string memory did,
            string memory publicKey,
            uint256 createdAt,
            bool active
        )
    {
        Identity storage identity = identities[identityHash];

        require(identity.createdAt != 0, "Identity not found");

        return (
            identity.identityHash,
            identity.did,
            identity.publicKey,
            identity.createdAt,
            identity.active
        );
    }

    function verifyIdentity(
        bytes32 expectedHash
    ) public view returns (bool) {
        Identity storage identity = identities[expectedHash];

        return (
            identity.createdAt != 0 &&
            identity.active &&
            identity.identityHash == expectedHash
        );
    }

    function deactivateIdentity(
        bytes32 identityHash
    ) public {
        Identity storage identity = identities[identityHash];

        require(identity.createdAt != 0, "Identity not found");
        require(identity.active, "Identity already inactive");

        identity.active = false;

        emit IdentityDeactivated(
            identityHash,
            msg.sender,
            block.timestamp
        );
    }

    function isIdentityActive(
        bytes32 identityHash
    ) public view returns (bool) {
        return (
            identities[identityHash].createdAt != 0 &&
            identities[identityHash].active
        );
    }
}
