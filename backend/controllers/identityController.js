const crypto = require("crypto");

const {
    createIdentity,
    getAllIdentities,
    getIdentityByPublicKey,
    getIdentityById
} = require("../models/identityModel");

const {
    generateKeyPair,
    createDID,
    verifySignature
} = require("../services/cryptoService");

const {
    createIdentityHash,
    registerIdentityOnBlockchain
} = require("../services/blockchainService");

const {
    createAuthenticationEvent,
    getIdentityActivityStats,
    getAuthenticationEvents,
    getIdentityAuthenticationEvents
} = require("../models/authenticationEventModel");

const {
    analyzeActivity
} = require("../services/aiService");


// --------------------------------------------------
// REGISTER IDENTITY
// --------------------------------------------------

const registerIdentity = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                message: "Name and email are required"
            });
        }

        // Generate Ed25519 key pair
        const keys = await generateKeyPair();

        // Create DID from public key
        const did = createDID(keys.publicKey);

        // Create blockchain identity hash
        const identityHash = createIdentityHash(
            did,
            keys.publicKey
        );

        // Register identity on blockchain
        const blockchainResult =
            await registerIdentityOnBlockchain(
                identityHash,
                did,
                keys.publicKey
            );

        // Store BOTH public and private keys
        const identity = createIdentity(
            name,
            email,
            did,
            keys.publicKey,
            keys.privateKey
        );

        return res.status(201).json({
            message: "Identity registered successfully",
            identity,
            blockchain: {
                transactionHash:
                    blockchainResult.transactionHash,
                blockNumber:
                    blockchainResult.blockNumber,
                identityHash
            }
        });

    } catch (error) {

        if (
            error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
            return res.status(409).json({
                message:
                    "An identity with this email already exists"
            });
        }

        console.error(
            "Identity registration error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to register identity",
            error:
                error.message
        });
    }
};


// --------------------------------------------------
// GET ALL IDENTITIES
// --------------------------------------------------

const getIdentities = (req, res) => {
    try {
        const identities = getAllIdentities();

        return res.json({
            identities
        });

    } catch (error) {

        console.error(
            "Get identities error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to retrieve identities"
        });
    }
};


// --------------------------------------------------
// VERIFY IDENTITY
// --------------------------------------------------

const verifyIdentity = async (req, res) => {
    try {

        const {
            data,
            signature,
            publicKey
        } = req.body;

        if (!data || !signature || !publicKey) {
            return res.status(400).json({
                message:
                    "Data, signature and publicKey are required"
            });
        }

        // Find identity by public key
        const identity =
            getIdentityByPublicKey(publicKey);

        // Verify cryptographic signature
        const verified =
            verifySignature(
                data,
                signature,
                publicKey
            );

        // Get requester IP
        const ipAddress =
            req.ip ||
            req.socket?.remoteAddress ||
            "unknown";

        const identityId =
            identity ? identity.id : null;

        // Record authentication event
        createAuthenticationEvent(
            identityId,
            verified,
            ipAddress
        );

        // Public key not registered
        if (!identity) {
            return res.status(404).json({
                verified,
                identity: null,
                ai: null,
                securityDecision:
                    "UNKNOWN_IDENTITY",
                accessGranted: false,
                message:
                    verified
                        ? "Cryptographic verification succeeded, but the public key is not registered in the identity system"
                        : "Identity verification failed because the public key is not registered"
            });
        }

        // Invalid signature
        if (!verified) {
            return res.status(401).json({
                verified: false,
                identity: {
                    id: identity.id,
                    name: identity.name,
                    email: identity.email,
                    did: identity.did
                },
                ai: null,
                securityDecision:
                    "INVALID_SIGNATURE",
                accessGranted: false,
                message:
                    "Identity verification failed"
            });
        }

        // Get identity activity
        const stats =
            getIdentityActivityStats(
                identity.id
            );

        const activity = {
            verificationAttempts:
                stats.verificationAttempts,

            failedVerifications:
                stats.failedVerifications,

            registrations:
                1,

            uniqueIPs:
                stats.uniqueIPs
        };

        // AI risk analysis
        const ai =
            await analyzeActivity(activity);

        let securityDecision;
        let accessGranted;

        if (ai.status === "HIGH_RISK") {

            securityDecision =
                "HIGH_RISK_BLOCKED";

            accessGranted = false;

        } else if (ai.status === "SUSPICIOUS") {

            securityDecision =
                "SUSPICIOUS_REVIEW";

            accessGranted = false;

        } else {

            securityDecision =
                "VERIFIED_NORMAL";

            accessGranted = true;
        }

        const response = {
            verified: true,

            identity: {
                id: identity.id,
                name: identity.name,
                email: identity.email,
                did: identity.did
            },

            ai: {
                anomaly: ai.anomaly,
                riskScore: ai.riskScore,
                status: ai.status
            },

            securityDecision,

            accessGranted
        };

        if (!accessGranted) {

            return res.status(403).json({
                ...response,

                message:
                    ai.status === "HIGH_RISK"
                        ? "Identity verified cryptographically, but access has been blocked because the AI detected high-risk activity"
                        : "Identity verified cryptographically, but access requires security review because the AI detected suspicious activity"
            });
        }

        return res.json({
            ...response,

            message:
                "Identity verified successfully"
        });

    } catch (error) {

        console.error(
            "Identity verification error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to verify identity",

            error:
                error.message
        });
    }
};


// --------------------------------------------------
// ANALYZE IDENTITY ACTIVITY
// --------------------------------------------------

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
            verificationAttempts:
                Number(verificationAttempts),

            failedVerifications:
                Number(failedVerifications),

            registrations:
                Number(registrations),

            uniqueIPs:
                Number(uniqueIPs)
        };

        if (
            Object.values(activity).some(
                value =>
                    !Number.isFinite(value) ||
                    value < 0
            )
        ) {
            return res.status(400).json({
                message:
                    "Activity values must be valid non-negative numbers"
            });
        }

        const aiResult =
            await analyzeActivity(activity);

        return res.json({
            message:
                "Identity activity analyzed successfully",

            activity,

            ai:
                aiResult
        });

    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to analyze identity activity",

            error:
                error.message
        });
    }
};


// --------------------------------------------------
// GET AUTHENTICATION EVENT HISTORY
// --------------------------------------------------

const getAuthenticationEventHistory = (
    req,
    res
) => {

    try {

        const requestedLimit =
            Number(req.query.limit) || 50;

        const limit =
            Math.min(
                Math.max(
                    Math.floor(requestedLimit),
                    1
                ),
                100
            );

        const events =
            getAuthenticationEvents(limit);

        return res.json({
            count:
                events.length,

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


// --------------------------------------------------
// GET IDENTITY ACTIVITY
// --------------------------------------------------

const getIdentityActivity = async (
    req,
    res
) => {

    try {

        const identityId =
            Number(req.params.id);

        if (
            !Number.isInteger(identityId) ||
            identityId <= 0
        ) {
            return res.status(400).json({
                message:
                    "Invalid identity ID"
            });
        }

        const identity =
            getAllIdentities().find(
                item =>
                    Number(item.id) === identityId
            );

        if (!identity) {
            return res.status(404).json({
                message:
                    "Identity not found"
            });
        }

        const stats =
            getIdentityActivityStats(
                identityId
            );

        const events =
            getIdentityAuthenticationEvents(
                identityId,
                50
            );

        const activity = {

            verificationAttempts:
                stats.verificationAttempts,

            failedVerifications:
                stats.failedVerifications,

            registrations:
                1,

            uniqueIPs:
                stats.uniqueIPs
        };

        const ai =
            await analyzeActivity(activity);

        let securityDecision;
        let accessGranted;

        if (ai.status === "HIGH_RISK") {

            securityDecision =
                "HIGH_RISK_BLOCKED";

            accessGranted = false;

        } else if (ai.status === "SUSPICIOUS") {

            securityDecision =
                "SUSPICIOUS_REVIEW";

            accessGranted = false;

        } else {

            securityDecision =
                "VERIFIED_NORMAL";

            accessGranted = true;
        }

        return res.json({

            identity: {
                id: identity.id,
                name: identity.name,
                email: identity.email,
                did: identity.did
            },

            stats,

            events,

            ai: {
                anomaly:
                    ai.anomaly,

                riskScore:
                    ai.riskScore,

                status:
                    ai.status
            },

            securityDecision,

            accessGranted
        });

    } catch (error) {

        console.error(
            "Identity activity error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to retrieve identity activity",

            error:
                error.message
        });
    }
};


// --------------------------------------------------
// VERIFY REGISTERED IDENTITY
// --------------------------------------------------

const verifyRegisteredIdentity = async (
    req,
    res
) => {

    try {

        const identityId =
            Number(req.params.id);

        if (
            !Number.isInteger(identityId) ||
            identityId <= 0
        ) {
            return res.status(400).json({
                message:
                    "Valid identity ID is required"
            });
        }

        /*
         * IMPORTANT:
         * getAllIdentities() intentionally does not
         * return private keys.
         *
         * Therefore we use getIdentityById()
         * which returns the private key.
         */
        const identity =
            getIdentityById(identityId);

        if (!identity) {
            return res.status(404).json({

                verified: false,

                identity: null,

                ai: null,

                securityDecision:
                    "UNKNOWN_IDENTITY",

                accessGranted:
                    false,

                message:
                    "Identity not found"
            });
        }

        if (!identity.privateKey) {

            return res.status(500).json({

                verified: false,

                identity: {
                    id: identity.id,
                    name: identity.name,
                    email: identity.email,
                    did: identity.did
                },

                ai: null,

                securityDecision:
                    "NO_PRIVATE_KEY",

                accessGranted:
                    false,

                message:
                    "Identity does not have a stored private key"
            });
        }

        if (!identity.publicKey) {

            return res.status(500).json({

                verified: false,

                identity: {
                    id: identity.id,
                    name: identity.name,
                    email: identity.email,
                    did: identity.did
                },

                ai: null,

                securityDecision:
                    "NO_PUBLIC_KEY",

                accessGranted:
                    false,

                message:
                    "Identity does not have a stored public key"
            });
        }

        /*
         * Create deterministic identity data.
         */
        const data =
            JSON.stringify({

                id:
                    identity.id,

                name:
                    identity.name,

                email:
                    identity.email,

                did:
                    identity.did
            });

        /*
         * Sign the identity data using
         * the stored Ed25519 private key.
         */
        const signature =
            crypto.sign(
                null,
                Buffer.from(data),
                identity.privateKey
            ).toString("base64");

        /*
         * Reuse the existing verification
         * and AI security pipeline.
         */
        req.body = {

            data,

            signature,

            publicKey:
                identity.publicKey
        };

        return verifyIdentity(
            req,
            res
        );

    } catch (error) {

        console.error(
            "Registered identity verification error:",
            error
        );

        return res.status(500).json({

            verified: false,

            identity: null,

            ai: null,

            securityDecision:
                "VERIFICATION_ERROR",

            accessGranted:
                false,

            message:
                "An error occurred during identity verification",

            error:
                error.message
        });
    }
};


// --------------------------------------------------
// EXPORT CONTROLLERS
// --------------------------------------------------

module.exports = {

    registerIdentity,

    getIdentities,

    verifyIdentity,

    verifyRegisteredIdentity,

    analyzeIdentityActivity,

    getAuthenticationEventHistory,

    getIdentityActivity
};

