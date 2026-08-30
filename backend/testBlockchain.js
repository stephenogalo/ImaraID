require("dotenv").config();

const {
    createIdentityHash,
    registerIdentityOnBlockchain
} = require("./services/blockchainService");

async function test() {
    const did = "did:aiid:test123";
    const publicKey = "test-public-key";

    const identityHash = createIdentityHash(
        did,
        publicKey
    );

    console.log("Identity Hash:");
    console.log(identityHash);

    const result = await registerIdentityOnBlockchain(
        identityHash,
        did,
        publicKey
    );

    console.log("Blockchain registration successful!");
    console.log("Transaction:", result.transactionHash);
    console.log("Block:", result.blockNumber);
}

test().catch((error) => {
    console.error("Blockchain registration failed:");
    console.error(error);
});
