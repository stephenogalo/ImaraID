
const fs = require("fs");
const path = require("path");
const { ethers } = require("../../backend/node_modules/ethers");

const projectRoot = path.resolve(__dirname, "../..");
const envPath = path.join(projectRoot, "backend", ".env");
const artifactPath = path.join(
  projectRoot,
  "blockchain",
  "artifacts",
  "contracts",
  "IdentityRegistry.sol",
  "IdentityRegistry.json"
);

function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Backend environment file not found: ${envPath}`);
  }

  loadEnv(envPath);

  const rpcUrl =
    process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "BLOCKCHAIN_PRIVATE_KEY is missing from backend/.env"
    );
  }

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Contract artifact not found. Compile IdentityRegistry.sol first."
    );
  }

  const artifact = JSON.parse(
    fs.readFileSync(artifactPath, "utf8")
  );

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying ImaraID IdentityRegistry...");
  console.log("Network:", rpcUrl);
  console.log("Deployer:", wallet.address);

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("\nDeployment successful.");
  console.log("New contract address:", address);
  console.log("Save this address in backend/.env as:");
  console.log(`IDENTITY_REGISTRY_ADDRESS=${address}`);

  await provider.destroy();
}

main().catch((error) => {
  console.error("Deployment failed:", error.message);
  process.exitCode = 1;
});
