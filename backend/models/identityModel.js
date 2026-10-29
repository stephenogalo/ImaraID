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
            private_key,
            active
        )
        VALUES (?, ?, ?, ?, ?, ?, 1)
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
        publicKey,
        active: 1
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
            public_key AS publicKey,
            active
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
            private_key AS privateKey,
            active
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
            private_key AS privateKey,
            active
        FROM identities
        WHERE id = ?
        LIMIT 1
    `).get(id);
};

const updateIdentity = (id, name, email) => {
    const result = db.prepare(`
        UPDATE identities
        SET name = ?, email = ?
        WHERE id = ? AND active = 1
    `).run(name, email, id);

    return result.changes > 0 ? getIdentityById(id) : null;
};

const setIdentityActive = (id, active) => {
    const result = db.prepare(`
        UPDATE identities
        SET active = ?
        WHERE id = ?
    `).run(active ? 1 : 0, id);

    return result.changes > 0 ? getIdentityById(id) : null;
};

module.exports = {
    createIdentity,
    getAllIdentities,
    getIdentityByPublicKey,
    getIdentityById,
    updateIdentity,
    setIdentityActive
};
