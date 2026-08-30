import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.create({
    type: "edr-simulated",
    chainType: "l1",
  });

  console.log("Deploying IdentityRegistry...");

  const IdentityRegistry =
    await ethers.getContractFactory("IdentityRegistry");

  const registry = await IdentityRegistry.deploy();

  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("IdentityRegistry deployed to:");
  console.log(address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
