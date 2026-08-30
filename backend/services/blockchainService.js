const { ethers } = require("ethers");
const path = require("path");

const contractData = require(
    path.join(
        __dirname,
        "../blockchain/IdentityRegistry.json"
    )
);

const RPC_URL =
    process.env.BLOCKCHAIN_RPC_URL ||
    "http://127.0.0.1:8545";

const CONTRACT_ADDRESS =
    process.env.IDENTITY_REGISTRY_ADDRESS;

const PRIVATE_KEY =
    process.env.BLOCKCHAIN_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL);

const getSigner = () => {
    if (!PRIVATE_KEY) {
        throw new Error(
            "BLOCKCHAIN_PRIVATE_KEY is not configured"
        );
    }

    return new ethers.Wallet(
        PRIVATE_KEY,
        provider
    );
};

const getContract = (withSigner = false) => {
    if (!CONTRACT_ADDRESS) {
        throw new Error(
            "IDENTITY_REGISTRY_ADDRESS is not configured"
        );
    }

    const signer = withSigner ? getSigner() : provider;

    return new ethers.Contract(
        CONTRACT_ADDRESS,
        contractData.abi,
        signer
    );
};

const createIdentityHash = (did, publicKey) => {
    return ethers.keccak256(
        ethers.solidityPacked(
            ["string", "string"],
            [did, publicKey]
        )
    );
};

const registerIdentityOnBlockchain = async (
    identityHash,
    did,
    publicKey
) => {
    const contract = getContract(true);

    const tx = await contract.registerIdentity(
        identityHash,
        did,
        publicKey
    );

    const receipt = await tx.wait();

    return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
    };
};

module.exports = {
    provider,
    getContract,
    createIdentityHash,
    registerIdentityOnBlockchain
};
