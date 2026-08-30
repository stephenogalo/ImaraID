const db = require("../config/database");

const createAuthenticationEvent = (
    identityId,
    success,
    ipAddress
) => {
    const createdAt = new Date().toISOString();

    const statement = db.prepare(`
        INSERT INTO authentication_events (
            identity_id,
            success,
            ip_address,
            created_at
        )
        VALUES (?, ?, ?, ?)
    `);

    const result = statement.run(
        identityId,
        success ? 1 : 0,
        ipAddress,
        createdAt
    );

    return {
        id: result.lastInsertRowid,
        identityId,
        success,
        ipAddress,
        createdAt
    };
};

const getAuthenticationEvents = (limit = 100) => {
    return db.prepare(`
        SELECT
            id,
            identity_id AS identityId,
            success,
            ip_address AS ipAddress,
            created_at AS createdAt
        FROM authentication_events
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);
};

const getIdentityAuthenticationEvents = (
    identityId,
    limit = 100
) => {
    return db.prepare(`
        SELECT
            id,
            identity_id AS identityId,
            success,
            ip_address AS ipAddress,
            created_at AS createdAt
        FROM authentication_events
        WHERE identity_id = ?
        ORDER BY id DESC
        LIMIT ?
    `).all(identityId, limit);
};

const getIdentityActivityStats = (identityId) => {
    const attemptsResult = db.prepare(`
        SELECT COUNT(*) AS total
        FROM authentication_events
        WHERE identity_id = ?
    `).get(identityId);

    const failedResult = db.prepare(`
        SELECT COUNT(*) AS total
        FROM authentication_events
        WHERE identity_id = ?
        AND success = 0
    `).get(identityId);

    const uniqueIPsResult = db.prepare(`
        SELECT COUNT(DISTINCT ip_address) AS total
        FROM authentication_events
        WHERE identity_id = ?
        AND ip_address IS NOT NULL
    `).get(identityId);

    return {
        verificationAttempts: attemptsResult.total,
        failedVerifications: failedResult.total,
        uniqueIPs: uniqueIPsResult.total
    };
};

module.exports = {
    createAuthenticationEvent,
    getAuthenticationEvents,
    getIdentityAuthenticationEvents,
    getIdentityActivityStats
};
