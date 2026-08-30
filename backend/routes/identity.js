const express = require("express");

const {
    registerIdentity,
    getIdentities,
    verifyIdentity,
    verifyRegisteredIdentity,
    analyzeIdentityActivity,
    getAuthenticationEventHistory,
    getIdentityActivity
} = require("../controllers/identityController");

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
    verifyIdentity
);

// Dashboard verification of a registered identity
router.post(
    "/:id/verify",
    verifyRegisteredIdentity
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
