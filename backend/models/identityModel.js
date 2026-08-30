const db = require("../config/database");

const createIdentity = (
    name,
    email,
    did,
    publicKey,
    privateKey
) => {
    const createdAt = new Date().toISOString();

    const statement = db.prepare(`
        INSERT INTO identities (
            name,
            email,
            created_at,
            did,
            public_key,
            private_key
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = statement.run(
        name,
        email,
        createdAt,
        did,
        publicKey,
        privateKey
    );

    return {
        id: result.lastInsertRowid,
        name,
        email,
        createdAt,
        did,
        publicKey
    };
};

const getAllIdentities = () => {
    return db.prepare(`
        SELECT
            id,
            name,
            email,
            created_at AS createdAt,
            did,
            public_key AS publicKey
        FROM identities
        ORDER BY id DESC
    `).all();
};

const getIdentityByPublicKey = (publicKey) => {
    return db.prepare(`
        SELECT
            id,
            name,
            email,
            created_at AS createdAt,
            did,
            public_key AS publicKey,
            private_key AS privateKey
        FROM identities
        WHERE public_key = ?
        LIMIT 1
    `).get(publicKey);
};

const getIdentityById = (id) => {
    return db.prepare(`
        SELECT
            id,
            name,
            email,
            created_at AS createdAt,
            did,
            public_key AS publicKey,
            private_key AS privateKey
        FROM identities
        WHERE id = ?
        LIMIT 1
    `).get(id);
};

module.exports = {
    createIdentity,
    getAllIdentities,
    getIdentityByPublicKey,
    getIdentityById
};
