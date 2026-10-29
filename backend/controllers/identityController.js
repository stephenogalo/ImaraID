
const crypto = require("crypto");

const {
    createIdentity,
    getAllIdentities,
    getIdentityByPublicKey,
    getIdentityById,
    updateIdentity: updateIdentityRecord,
    setIdentityActive
} = require("../models/identityModel");

const {
    generateKeyPair,
    createDID,
    verifySignature
} = require("../services/cryptoService");

const {
    createIdentityHash,
    registerIdentityOnBlockchain,
    verifyIdentityOnBlockchain,
    getIdentityOnBlockchain,
    deactivateIdentityOnBlockchain
} = require("../services/blockchainService");

const {
    createAuthenticationEvent,
    getIdentityActivityStats,
    getAuthenticationEvents,
    getIdentityAuthenticationEvents,
    getRecentFailedVerifications
} = require("../models/authenticationEventModel");

const {
    analyzeActivity
} = require("../services/aiService");

// One consistent AI decision policy for all relevant endpoints.
const decideAccess = (ai) => {
    const status = String(ai?.status || "").toUpperCase();

    if (status === "NORMAL") {
        return {
            securityDecision: "VERIFIED_NORMAL",
            accessGranted: true
        };
    }

    if (status === "SUSPICIOUS") {
        return {
            securityDecision: "SUSPICIOUS_REVIEW",
            accessGranted: false
        };
    }

    if (status === "HIGH_RISK") {
        return {
            securityDecision: "HIGH_RISK_BLOCKED",
            accessGranted: false
        };
    }

    // Fail closed if AI output is missing or unrecognized.
    return {
        securityDecision: "AI_DECISION_UNAVAILABLE",
        accessGranted: false
    };
};

const publicIdentity = (identity) => ({
    id: identity.id,
    name: identity.name,
    email: identity.email,
    did: identity.did,
    active: Boolean(Number(identity.active ?? 1))
});

// REGISTER IDENTITY
const registerIdentity = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim()
        ) {
            return res.status(400).json({
                message: "Name and email are required"
            });
        }

        const keys = await generateKeyPair();
        const did = createDID(keys.publicKey);
        const identityHash = createIdentityHash(
            did,
            keys.publicKey
        );

        const blockchainResult =
            await registerIdentityOnBlockchain(
                identityHash,
                did,
                keys.publicKey
            );

        const identity = createIdentity(
            name.trim(),
            email.trim(),
            did,
            keys.publicKey,
            keys.privateKey
        );

        createAuthenticationEvent(
            identity.id, true, req.ip, "IDENTITY_REGISTERED"
        );

        return res.status(201).json({
            message: "Identity registered successfully",
            identity,
            blockchain: {
                transactionHash: blockchainResult.transactionHash,
                blockNumber: blockchainResult.blockNumber,
                identityHash,
                contractAddress:
                    process.env.IDENTITY_REGISTRY_ADDRESS
            }
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                message:
                    "An identity with this email already exists"
            });
        }

        console.error("Identity registration error:", error);

        return res.status(500).json({
            message: "Failed to register identity",
            error: error.message
        });
    }
};

// GET ALL IDENTITIES
const getIdentities = (req, res) => {
    try {
        return res.json({
            identities: getAllIdentities()
        });
    } catch (error) {
        console.error("Get identities error:", error);

        return res.status(500).json({
            message: "Failed to retrieve identities"
        });
    }
};

// VERIFY IDENTITY USING CRYPTOGRAPHY, BLOCKCHAIN AND AI
const verifyIdentity = async (req, res) => {
    let identityId = null;
    let ipAddress = "unknown";
    let eventRecorded = false;

    try {
        const { data, signature, publicKey } = req.body;

        if (
            typeof data !== "string" ||
            typeof signature !== "string" ||
            typeof publicKey !== "string" ||
            !data ||
            !signature ||
            !publicKey
        ) {
            return res.status(400).json({
                verified: false,
                accessGranted: false,
                message:
                    "Data, signature and publicKey are required"
            });
        }

        ipAddress =
            req.ip ||
            req.socket?.remoteAddress ||
            "unknown";

        const identity = getIdentityByPublicKey(publicKey);

        // Unknown identities are never eligible for access.
        if (!identity) {
            createAuthenticationEvent(
                null,
                false,
                ipAddress
            );
            eventRecorded = true;

            return res.status(404).json({
                verified: false,
                identity: null,
                blockchain: {
                    verified: false,
                    active: false
                },
                ai: null,
                securityDecision: "UNKNOWN_IDENTITY",
                accessGranted: false,
                message:
                    "The public key is not registered in ImaraID"
            });
        }

        identityId = identity.id;

        if (!Boolean(Number(identity.active ?? 1))) {
            createAuthenticationEvent(identity.id, false, ipAddress);
            eventRecorded = true;

            return res.status(403).json({
                verified: false,
                identity: publicIdentity(identity),
                blockchain: {
                    verified: false,
                    active: false
                },
                securityDecision: "IDENTITY_REVOKED",
                accessGranted: false,
                code: "IDENTITY_REVOKED",
                message: "This identity has been revoked."
            });
        }

        // Reject invalid signatures before consulting the AI.
        const signatureVerified = verifySignature(
            data,
            signature,
            publicKey
        );

        if (!signatureVerified) {
            createAuthenticationEvent(
                identity.id,
                false,
                ipAddress
            );
            eventRecorded = true;

            return res.status(401).json({
                verified: false,
                identity: publicIdentity(identity),
                blockchain: null,
                ai: null,
                securityDecision: "INVALID_SIGNATURE",
                accessGranted: false,
                message:
                    "Digital signature verification failed"
            });
        }

        const identityHash = createIdentityHash(
            identity.did,
            identity.publicKey
        );

        let blockchainVerified = false;
        let blockchainIdentity = null;

        try {
            blockchainVerified =
                await verifyIdentityOnBlockchain(identityHash);

            if (blockchainVerified) {
                blockchainIdentity =
                    await getIdentityOnBlockchain(identityHash);

                blockchainVerified =
                    blockchainIdentity?.active === true &&
                    typeof blockchainIdentity.identityHash === "string" &&
                    blockchainIdentity.identityHash.toLowerCase() ===
                        identityHash.toLowerCase() &&
                    blockchainIdentity.did === identity.did &&
                    blockchainIdentity.publicKey === identity.publicKey;
            }
        } catch (blockchainError) {
            console.error(
                "Blockchain verification error:",
                blockchainError.message
            );
        }

        // Blockchain failure always denies access, irrespective of AI.
        if (!blockchainVerified) {
            createAuthenticationEvent(
                identity.id,
                false,
                ipAddress
            );
            eventRecorded = true;

            return res.status(403).json({
                verified: false,
                identity: publicIdentity(identity),
                blockchain: {
                    verified: false,
                    active: false
                },
                ai: null,
                securityDecision:
                    "BLOCKCHAIN_VERIFICATION_FAILED",
                accessGranted: false,
                message:
                    "Access denied: the identity could not be confirmed as active on the blockchain"
            });
        }

        const stats = getIdentityActivityStats(identity.id);

        const activity = {
            verificationAttempts: stats.verificationAttempts,
            failedVerifications: stats.failedVerifications,
            recentFailedVerifications: stats.recentFailedVerifications || 0,
            registrations: 1,
            uniqueIPs: stats.uniqueIPs
        };

        let ai;

        try {
            ai = await analyzeActivity(activity);
        } catch (aiError) {
            console.error("AI analysis failed:", aiError.message);

            createAuthenticationEvent(
                identity.id,
                false,
                ipAddress
            );
            eventRecorded = true;

            return res.status(503).json({
                verified: true,
                identity: publicIdentity(identity),
                blockchain: {
                    verified: true,
                    active: true,
                    identityHash,
                    contractAddress:
                        process.env.IDENTITY_REGISTRY_ADDRESS
                },
                ai: null,
                securityDecision: "AI_DECISION_UNAVAILABLE",
                accessGranted: false,
                message:
                    "Access denied: security risk analysis is unavailable"
            });
        }

        const decision = decideAccess(ai);

        createAuthenticationEvent(
            identity.id,
            decision.accessGranted,
            ipAddress
        );
        eventRecorded = true;

        const response = {
            verified: true,
            identity: publicIdentity(identity),
            blockchain: {
                verified: true,
                active: true,
                identityHash,
                contractAddress:
                    process.env.IDENTITY_REGISTRY_ADDRESS
            },
            ai: {
                anomaly: ai.anomaly,
                riskScore: ai.riskScore,
                status: ai.status,
                mlAnomaly: ai.mlAnomaly,
                burstRisk: ai.burstRisk,
                recentFailedVerifications: ai.recentFailedVerifications,
                explanation: ai.explanation,
                indicators: ai.indicators
            },
            securityDecision: decision.securityDecision,
            accessGranted: decision.accessGranted
        };

        if (!decision.accessGranted) {
            return res.status(403).json({
                ...response,
                message:
                    "Cryptographic and blockchain checks passed, but AI risk analysis denied access"
            });
        }

        return res.json({
            ...response,
            message:
                "Identity verified successfully by cryptography, blockchain and AI risk analysis"
        });
    } catch (error) {
        console.error("Identity verification error:", error);

        if (!eventRecorded && identityId !== null) {
            try {
                createAuthenticationEvent(
                    identityId,
                    false,
                    ipAddress
                );
            } catch (eventError) {
                console.error(
                    "Failed to record authentication event:",
                    eventError.message
                );
            }
        }

        return res.status(500).json({
            verified: false,
            identity: null,
            blockchain: null,
            ai: null,
            securityDecision: "VERIFICATION_ERROR",
            accessGranted: false,
            message: "Failed to verify identity",
            error: error.message
        });
    }
};

// VERIFY A REGISTERED IDENTITY BY ID
const verifyRegisteredIdentity = async (req, res) => {
    try {
        const identityId = Number(req.params.id);

        if (
            !Number.isInteger(identityId) ||
            identityId <= 0
        ) {
            return res.status(400).json({
                verified: false,
                accessGranted: false,
                message: "Valid identity ID is required"
            });
        }

        const identity = getIdentityById(identityId);

        if (!identity) {
            return res.status(404).json({
                verified: false,
                identity: null,
                ai: null,
                securityDecision: "UNKNOWN_IDENTITY",
                accessGranted: false,
                message: "Identity not found"
            });
        }

        if (!identity.privateKey || !identity.publicKey) {
            return res.status(409).json({
                verified: false,
                identity: publicIdentity(identity),
                ai: null,
                securityDecision: "KEYS_UNAVAILABLE",
                accessGranted: false,
                message:
                    "This stored identity does not have the keys required for verification"
            });
        }

        const data = JSON.stringify({
            id: identity.id,
            name: identity.name,
            email: identity.email,
            did: identity.did
        });

        const signature = crypto.sign(
            null,
            Buffer.from(data),
            identity.privateKey
        ).toString("base64");

        req.body = {
            data,
            signature,
            publicKey: identity.publicKey
        };

        return await verifyIdentity(req, res);
    } catch (error) {
        console.error(
            "Registered identity verification error:",
            error
        );

        return res.status(500).json({
            verified: false,
            identity: null,
            ai: null,
            securityDecision: "VERIFICATION_ERROR",
            accessGranted: false,
            message:
                "An error occurred during identity verification"
        });
    }
};

// ANALYZE IDENTITY ACTIVITY
const analyzeIdentityActivity = async (req, res) => {
    try {
        const {
            verificationAttempts,
            failedVerifications,
            registrations,
            uniqueIPs
        } = req.body;

        if (
            verificationAttempts === undefined ||
            failedVerifications === undefined ||
            registrations === undefined ||
            uniqueIPs === undefined
        ) {
            return res.status(400).json({
                message:
                    "verificationAttempts, failedVerifications, registrations and uniqueIPs are required"
            });
        }

        const activity = {
            verificationAttempts: Number(verificationAttempts),
            failedVerifications: Number(failedVerifications),
            registrations: Number(registrations),
            uniqueIPs: Number(uniqueIPs)
        };

        if (
            Object.values(activity).some(
                value =>
                    !Number.isFinite(value) ||
                    value < 0 ||
                    !Number.isInteger(value)
            ) ||
            activity.failedVerifications >
                activity.verificationAttempts ||
            activity.registrations > activity.verificationAttempts ||
            activity.failedVerifications > 0 &&
                activity.verificationAttempts === 0
        ) {
            return res.status(400).json({
                message:
                    "Activity values must be non-negative integers, and failed verifications cannot exceed total attempts"
            });
        }

        const ai = await analyzeActivity(activity);
        const decision = decideAccess(ai);

        return res.json({
            message: "Identity activity analyzed successfully",
            activity,
            ai,
            securityDecision: decision.securityDecision,
            accessGranted: decision.accessGranted
        });
    } catch (error) {
        console.error("AI analysis error:", error);

        return res.status(500).json({
            message: "Failed to analyze identity activity",
            error: error.message
        });
    }
};

// GET AUTHENTICATION EVENT HISTORY
const getAuthenticationEventHistory = (req, res) => {
    try {
        const requestedLimit = Number(req.query.limit) || 50;

        const limit = Math.min(
            Math.max(Math.floor(requestedLimit), 1),
            100
        );

        const events = getAuthenticationEvents(limit);

        return res.json({
            count: events.length,
            events
        });
    } catch (error) {
        console.error(
            "Authentication event history error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to retrieve authentication events"
        });
    }
};

// GET IDENTITY ACTIVITY
const getIdentityActivity = async (req, res) => {
    try {
        const identityId = Number(req.params.id);

        if (
            !Number.isInteger(identityId) ||
            identityId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid identity ID"
            });
        }

        const identity = getIdentityById(identityId);

        if (!identity) {
            return res.status(404).json({
                message: "Identity not found"
            });
        }

        const stats = getIdentityActivityStats(identityId);

        const events = getIdentityAuthenticationEvents(
            identityId,
            50
        );

        const recentFailedVerifications =
            getRecentFailedVerifications(identityId, 15);

        const activity = {
            verificationAttempts: stats.verificationAttempts,
            failedVerifications: stats.failedVerifications,
            recentFailedVerifications,
            registrations: 1,
            uniqueIPs: stats.uniqueIPs
        };

        const ai = await analyzeActivity(activity);
        const decision = decideAccess(ai);

        return res.json({
            identity: publicIdentity(identity),
            stats,
            events,
            ai: {
                anomaly: ai.anomaly,
                riskScore: ai.riskScore,
                status: ai.status,
                mlAnomaly: ai.mlAnomaly,
                securityRisk: ai.securityRisk,
                failureRisk: ai.failureRisk,
                ipRisk: ai.ipRisk,
                burstRisk: ai.burstRisk,
                recentFailedVerifications,
                explanation: ai.explanation,
                indicators: ai.indicators
            },
            securityDecision: decision.securityDecision,
            accessGranted: decision.accessGranted
        });
    } catch (error) {
        console.error("Identity activity error:", error);

        return res.status(500).json({
            message: "Failed to retrieve identity activity",
            error: error.message
        });
    }
};


// EDIT IDENTITY: only name and email can be changed.
const updateIdentity = (req, res) => {
    try {
        const identityId = Number(req.params.id);
        const { name, email } = req.body || {};

        if (!Number.isInteger(identityId) || identityId <= 0) {
            return res.status(400).json({ message: "Invalid identity ID" });
        }

        if (
            typeof name !== "string" || !name.trim() ||
            typeof email !== "string" || !email.trim()
        ) {
            return res.status(400).json({
                message: "A valid name and email are required"
            });
        }

        const existing = getIdentityById(identityId);

        if (!existing) {
            return res.status(404).json({ message: "Identity not found" });
        }

        if (!Boolean(Number(existing.active ?? 1))) {
            return res.status(409).json({
                message: "A revoked identity cannot be edited"
            });
        }

        const updated = updateIdentityRecord(
            identityId,
            name.trim(),
            email.trim()
        );

        if (!updated) {
            return res.status(409).json({
                message: "Identity could not be updated"
            });
        }

        createAuthenticationEvent(
            identityId, true, req.ip, "IDENTITY_UPDATED"
        );

        return res.json({
            message: "Identity updated successfully",
            identity: publicIdentity(updated)
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                message: "That email address is already registered"
            });
        }

        console.error("Identity update error:", error);
        return res.status(500).json({
            message: "Failed to update identity"
        });
    }
};

// REVOKE IDENTITY: deactivate on-chain and preserve the local record.
const revokeIdentity = async (req, res) => {
    try {
        const identityId = Number(req.params.id);

        if (!Number.isInteger(identityId) || identityId <= 0) {
            return res.status(400).json({ message: "Invalid identity ID" });
        }

        const identity = getIdentityById(identityId);

        if (!identity) {
            return res.status(404).json({ message: "Identity not found" });
        }

        if (!Boolean(Number(identity.active ?? 1))) {
            return res.status(409).json({
                message: "This identity has already been revoked",
                identity: publicIdentity(identity)
            });
        }

        const identityHash = createIdentityHash(
            identity.did,
            identity.publicKey
        );

        const chainIdentity = await getIdentityOnBlockchain(identityHash);

        if (
            !chainIdentity.active ||
            String(chainIdentity.identityHash).toLowerCase() !==
                identityHash.toLowerCase() ||
            chainIdentity.did !== identity.did ||
            chainIdentity.publicKey !== identity.publicKey
        ) {
            return res.status(409).json({
                message: "The on-chain identity does not match an active registered identity. No changes were made."
            });
        }

        const transaction = await deactivateIdentityOnBlockchain(identityHash);
        const updated = setIdentityActive(identityId, false);

        if (!updated) {
            return res.status(500).json({
                message: "The blockchain identity was revoked, but the local record could not be updated. Reconcile the database status before continuing."
            });
        }

        return res.json({
            message: "Identity revoked successfully",
            identity: publicIdentity(updated),
            blockchain: {
                active: false,
                transactionHash: transaction.transactionHash,
                blockNumber: transaction.blockNumber
            }
        });
    } catch (error) {
        console.error("Identity revocation error:", error);
        return res.status(500).json({
            message: "Failed to revoke identity",
            error: error.message
        });
    }
};

module.exports = {
    registerIdentity,
    getIdentities,
    verifyIdentity,
    verifyRegisteredIdentity,
    analyzeIdentityActivity,
    getAuthenticationEventHistory,
    getIdentityActivity,
    updateIdentity,
    revokeIdentity
};
