const cryptoService = require("./services/cryptoService");

async function test() {
    const keys = await cryptoService.generateKeyPair();

    const data = "Stephen Ogalo identity verification";

    const signature = cryptoService.signData(
        data,
        keys.privateKey
    );

    const verified = cryptoService.verifySignature(
        data,
        signature,
        keys.publicKey
    );

    console.log("Signature generated:", !!signature);
    console.log("Signature verified:", verified);
}

test();
