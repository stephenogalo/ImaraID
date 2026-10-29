const { ethers } = require("ethers");
const path = require("path");

const contractData = require(
  path.join(__dirname, "../blockchain/IdentityRegistry.json")
);

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS;
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;
const provider = new ethers.JsonRpcProvider(RPC_URL);

let signer;
let registrationQueue = Promise.resolve();

function getSigner() {
  if (!PRIVATE_KEY) throw new Error("BLOCKCHAIN_PRIVATE_KEY is not configured");
  if (!signer) signer = new ethers.NonceManager(new ethers.Wallet(PRIVATE_KEY, provider));
  return signer;
}

function getContract(withSigner = false) {
  if (!CONTRACT_ADDRESS) throw new Error("IDENTITY_REGISTRY_ADDRESS is not configured");
  return new ethers.Contract(
    CONTRACT_ADDRESS,
    contractData.abi,
    withSigner ? getSigner() : provider
  );
}

function createIdentityHash(did, publicKey) {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "string"], [did, publicKey])
  );
}

function registerIdentityOnBlockchain(identityHash, did, publicKey) {
  const operation = registrationQueue.then(async () => {
    const activeSigner = getSigner();
    const tx = await getContract(true).registerIdentity(
      identityHash, did, publicKey
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error("Blockchain identity registration failed");
    }
    return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
  });

  registrationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function deactivateIdentityOnBlockchain(identityHash) {
  const contract = getContract(true);
  const tx = await contract.deactivateIdentity(identityHash);
  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Blockchain identity deactivation failed");
  }

  const stillActive = await getContract().isIdentityActive(identityHash);
  if (stillActive) {
    throw new Error("Blockchain still reports the identity as active");
  }

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function verifyIdentityOnBlockchain(identityHash) {
  return await getContract().verifyIdentity(identityHash);
}

async function getIdentityOnBlockchain(identityHash) {
  const result = await getContract().getIdentity(identityHash);
  return {
    identityHash: result[0],
    did: result[1],
    publicKey: result[2],
    createdAt: Number(result[3]),
    active: result[4],
  };
}

module.exports = {
  provider,
  getContract,
  createIdentityHash,
  registerIdentityOnBlockchain,
  deactivateIdentityOnBlockchain,
  verifyIdentityOnBlockchain,
  getIdentityOnBlockchain,
};
