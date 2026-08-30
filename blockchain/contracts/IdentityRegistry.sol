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

    mapping(address => Identity) private identities;

    event IdentityRegistered(
        address indexed owner,
        bytes32 indexed identityHash,
        string did,
        uint256 createdAt
    );

    event IdentityDeactivated(
        address indexed owner,
        uint256 timestamp
    );

    function registerIdentity(
        bytes32 identityHash,
        string memory did,
        string memory publicKey
    ) public {

        require(
            identities[msg.sender].createdAt == 0,
            "Identity already registered"
        );

        identities[msg.sender] = Identity({
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
        address owner
    )
        public
        view
        returns (
            bytes32 identityHash,
            string memory did,
            string memory publicKey,
            uint256 createdAt,
            bool active
        )
    {
        Identity memory identity = identities[owner];

        require(
            identity.createdAt != 0,
            "Identity not found"
        );

        return (
            identity.identityHash,
            identity.did,
            identity.publicKey,
            identity.createdAt,
            identity.active
        );
    }

    function deactivateIdentity() public {

        require(
            identities[msg.sender].createdAt != 0,
            "Identity not found"
        );

        require(
            identities[msg.sender].active,
            "Identity already inactive"
        );

        identities[msg.sender].active = false;

        emit IdentityDeactivated(
            msg.sender,
            block.timestamp
        );
    }

    function isIdentityActive(
        address owner
    ) public view returns (bool) {

        return identities[owner].active;
    }
}
