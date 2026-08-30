const fs = require("fs");
const path = require("path");

const {
    generateKeyPair,
    createDID,
    signData
} = require("./services/cryptoService");

const {
    createIdentity
} = require("./models/identityModel");


async function sendVerification(
    data,
    signature,
    publicKey
) {
    const response = await fetch(
        "http://localhost:5000/api/identity/verify",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                data,
                signature,
                publicKey
            })
        }
    );

    const result = await response.json();

    return {
        status: response.status,
        result
    };
}


async function main() {

    console.log("====================================");
    console.log("AI SECURITY VERIFICATION TEST");
    console.log("====================================\n");


    // ------------------------------------------
    // CREATE ONE TEST IDENTITY
    // ------------------------------------------

    console.log(
        "Creating development test identity...\n"
    );

    const keys = await generateKeyPair();

    const did = createDID(
        keys.publicKey
    );

    const identity = createIdentity(
        "AI Security Test",
        `aiset-${Date.now()}@example.com`,
        did,
        keys.publicKey
    );


    console.log(
        "Identity ID:",
        identity.id
    );

    console.log(
        "DID:",
        identity.did
    );


    // ------------------------------------------
    // SAVE TEST KEYS LOCALLY
    // ------------------------------------------

    const keyDirectory =
        path.join(
            __dirname,
            "test-keys"
        );

    fs.mkdirSync(
        keyDirectory,
        {
            recursive: true
        }
    );


    const keyFile =
        path.join(
            keyDirectory,
            `${identity.id}.json`
        );


    fs.writeFileSync(
        keyFile,
        JSON.stringify(
            {
                identityId: identity.id,
                did: identity.did,
                privateKey: keys.privateKey,
                publicKey: keys.publicKey
            },
            null,
            2
        ),
        {
            mode: 0o600
        }
    );


    console.log(
        "\nTest keys saved:",
        keyFile
    );


    // ------------------------------------------
    // DATA TO BE SIGNED
    // ------------------------------------------

    const data =
        "AI blockchain identity security test";


    // ------------------------------------------
    // VALID SIGNATURE
    // ------------------------------------------

    const validSignature =
        signData(
            data,
            keys.privateKey
        );


    console.log(
        "\n1. NORMAL VERIFICATION"
    );

    console.log(
        "----------------------"
    );


    const normalResult =
        await sendVerification(
            data,
            validSignature,
            keys.publicKey
        );


    console.log(
        JSON.stringify(
            normalResult,
            null,
            2
        )
    );


    // ------------------------------------------
    // CREATE ATTACKER KEY
    // ------------------------------------------

    const attackerKeys =
        await generateKeyPair();


    const invalidSignature =
        signData(
            data,
            attackerKeys.privateKey
        );


    // ------------------------------------------
    // FAILED ATTEMPTS
    // ------------------------------------------

    const failedAttempts = 20;

    let failedCount = 0;


    console.log(
        "\n2. SIMULATING FAILED ATTEMPTS"
    );

    console.log(
        "-----------------------------"
    );


    for (
        let attempt = 1;
        attempt <= failedAttempts;
        attempt++
    ) {

        const result =
            await sendVerification(
                data,
                invalidSignature,
                keys.publicKey
            );


        if (
            result.result.verified === false
        ) {
            failedCount++;
        }


        console.log(
            `Failed attempt ${attempt}: HTTP ${result.status}`
        );
    }


    console.log(
        `\nRecorded failed attempts: ${failedCount}`
    );


    // ------------------------------------------
    // VALID VERIFICATION AFTER FAILURES
    // ------------------------------------------

    console.log(
        "\n3. VERIFICATION AFTER FAILED ACTIVITY"
    );

    console.log(
        "--------------------------------------"
    );


    const finalResult =
        await sendVerification(
            data,
            validSignature,
            keys.publicKey
        );


    console.log(
        JSON.stringify(
            finalResult,
            null,
            2
        )
    );


    console.log(
        "\n===================================="
    );

    console.log(
        "TEST COMPLETE"
    );

    console.log(
        "===================================="
    );
}


main().catch(
    (error) => {

        console.error(
            "\nTest failed:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
);
