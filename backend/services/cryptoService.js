const crypto = require("crypto");

const generateKeyPair = () => {
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair(
            "ed25519",
            {
                publicKeyEncoding: {
                    type: "spki",
                    format: "pem"
                },
                privateKeyEncoding: {
                    type: "pkcs8",
                    format: "pem"
                }
            },
            (err, publicKey, privateKey) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    publicKey,
                    privateKey
                });
            }
        );
    });
};

const createDID = (publicKey) => {
    const hash = crypto
        .createHash("sha256")
        .update(publicKey)
        .digest("hex");

    return `did:aiid:${hash.substring(0, 32)}`;
};

const signData = (data, privateKey) => {
    const signature = crypto.sign(
        null,
        Buffer.from(data),
        privateKey
    );

    return signature.toString("base64");
};

const verifySignature = (data, signature, publicKey) => {
    return crypto.verify(
        null,
        Buffer.from(data),
        publicKey,
        Buffer.from(signature, "base64")
    );
};

module.exports = {
    generateKeyPair,
    createDID,
    signData,
    verifySignature
};
