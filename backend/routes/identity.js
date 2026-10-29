const express = require("express");

const {
    registerIdentity,
    getIdentities,
    verifyIdentity,
    verifyRegisteredIdentity,
    analyzeIdentityActivity,
    getAuthenticationEventHistory,
    getIdentityActivity,
    updateIdentity,
    revokeIdentity
} = require("../controllers/identityController");

const rateLimit = require("express-rate-limit");

const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        verified: false,
        accessGranted: false,
        securityDecision: "RATE_LIMITED",
        message: "Too many verification attempts. Please try again in 15 minutes."
    }
});

const router = express.Router();

router.get("/test", (req, res) => {
    res.json({
        message: "Identity API is working"
    });
});

router.post(
    "/register",
    registerIdentity
);

router.get(
    "/",
    getIdentities
);

// Direct cryptographic verification
router.post(
    "/verify",
    verificationLimiter,
    verifyIdentity
);

// Dashboard verification of a registered identity
router.post(
    "/:id/verify",
    verificationLimiter,
    verifyRegisteredIdentity
);

// Edit an active identity's name and email.
router.put(
    "/:id",
    updateIdentity
);

// Revoke an identity on the blockchain while preserving its history.
router.post(
    "/:id/revoke",
    revokeIdentity
);

router.post(
    "/analyze",
    analyzeIdentityActivity
);

router.get(
    "/events",
    getAuthenticationEventHistory
);

router.get(
    "/:id/activity",
    getIdentityActivity
);

module.exports = router;
