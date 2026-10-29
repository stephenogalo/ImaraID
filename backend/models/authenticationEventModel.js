const db = require("../config/database");

const createAuthenticationEvent = (
    identityId,
    success,
    ipAddress,
    eventType
) => {
    const createdAt = new Date().toISOString();
    const type = eventType || (
        success ? "VERIFICATION_SUCCEEDED" : "VERIFICATION_FAILED"
    );

    const statement = db.prepare(`
        INSERT INTO authentication_events (
            identity_id,
            success,
            ip_address,
            created_at,
            event_type
        )
        VALUES (?, ?, ?, ?, ?)
    `);

    const result = statement.run(
        identityId,
        success ? 1 : 0,
        ipAddress || null,
        createdAt,
        type
    );

    return {
        id: result.lastInsertRowid,
        identityId,
        success,
        ipAddress: ipAddress || null,
        createdAt,
        eventType: type
    };
};

const getAuthenticationEvents = (limit = 100) => {
    return db.prepare(`
        SELECT
            id,
            identity_id AS identityId,
            success,
            ip_address AS ipAddress,
            created_at AS createdAt,
            event_type AS eventType
        FROM authentication_events
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);
};

const getIdentityAuthenticationEvents = (identityId, limit = 100) => {
    return db.prepare(`
        SELECT
            id,
            identity_id AS identityId,
            success,
            ip_address AS ipAddress,
            created_at AS createdAt,
            event_type AS eventType
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
          AND event_type IN (
              'VERIFICATION_SUCCEEDED',
              'VERIFICATION_FAILED'
          )
    `).get(identityId);

    const failedResult = db.prepare(`
        SELECT COUNT(*) AS total
        FROM authentication_events
        WHERE identity_id = ?
          AND event_type = 'VERIFICATION_FAILED'
    `).get(identityId);

    const uniqueIPsResult = db.prepare(`
        SELECT COUNT(DISTINCT ip_address) AS total
        FROM authentication_events
        WHERE identity_id = ?
          AND event_type IN (
              'VERIFICATION_SUCCEEDED',
              'VERIFICATION_FAILED'
          )
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
