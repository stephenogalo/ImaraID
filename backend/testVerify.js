const cryptoService = require("./services/cryptoService");

async function test() {
    const keys = await cryptoService.generateKeyPair();

    const data = "Stephen Ogalo identity verification";

    const signature = cryptoService.signData(
        data,
        keys.privateKey
    );

    console.log("\nDATA:");
    console.log(data);

    console.log("\nSIGNATURE:");
    console.log(signature);

    console.log("\nPUBLIC KEY:");
    console.log(keys.publicKey);

    console.log("\nVERIFIED LOCALLY:");
    console.log(
        cryptoService.verifySignature(
            data,
            signature,
            keys.publicKey
        )
    );
}

test();
