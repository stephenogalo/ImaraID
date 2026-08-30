require("dotenv").config();

const {
    analyzeActivity
} = require("./services/aiService");

const testAI = async () => {

    console.log("Testing local AI anomaly detection...\n");

    // Normal identity activity
    const normalActivity = {
        verificationAttempts: 3,
        failedVerifications: 0,
        registrations: 2,
        uniqueIPs: 1
    };

    console.log("NORMAL ACTIVITY:");
    console.log(normalActivity);

    try {

        const normalResult =
            await analyzeActivity(normalActivity);

        console.log("AI RESULT:");
        console.log(normalResult);

    } catch (error) {

        console.error(
            "AI analysis failed:",
            error.message
        );

        return;
    }


    console.log("\n-----------------------------\n");


    // Suspicious identity activity
    const suspiciousActivity = {
        verificationAttempts: 100,
        failedVerifications: 80,
        registrations: 20,
        uniqueIPs: 15
    };

    console.log("SUSPICIOUS ACTIVITY:");
    console.log(suspiciousActivity);

    try {

        const suspiciousResult =
            await analyzeActivity(
                suspiciousActivity
            );

        console.log("AI RESULT:");
        console.log(suspiciousResult);

    } catch (error) {

        console.error(
            "AI analysis failed:",
            error.message
        );
    }
};


testAI();
