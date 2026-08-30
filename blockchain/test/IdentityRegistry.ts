import { expect } from "chai";
import hre from "hardhat";

describe("IdentityRegistry", function () {

  async function deployRegistry() {
    const { ethers } = await hre.network.create({
      type: "edr-simulated",
      chainType: "l1",
    });

    const [owner, otherAccount] = await ethers.getSigners();

    const IdentityRegistry =
      await ethers.getContractFactory("IdentityRegistry");

    const registry = await IdentityRegistry.deploy();

    await registry.waitForDeployment();

    return {
      registry,
      owner,
      otherAccount,
      ethers
    };
  }

  it("should register an identity", async function () {

    const { registry, owner, ethers } = await deployRegistry();

    const identityHash = ethers.keccak256(
      ethers.toUtf8Bytes("Stephen Ogalo identity")
    );

    const did = "did:aiid:test123";
    const publicKey = "test-public-key";

    await registry.registerIdentity(
      identityHash,
      did,
      publicKey
    );

    const identity = await registry.getIdentity(owner.address);

    expect(identity[0]).to.equal(identityHash);
    expect(identity[1]).to.equal(did);
    expect(identity[2]).to.equal(publicKey);
    expect(identity[4]).to.equal(true);
  });

  it("should reject duplicate identity registration", async function () {

    const { registry, ethers } = await deployRegistry();

    const identityHash = ethers.keccak256(
      ethers.toUtf8Bytes("Stephen Ogalo identity")
    );

    await registry.registerIdentity(
      identityHash,
      "did:aiid:test123",
      "test-public-key"
    );

    await expect(
      registry.registerIdentity(
        identityHash,
        "did:aiid:test456",
        "another-key"
      )
    ).to.be.revertedWith("Identity already registered");
  });

  it("should deactivate an identity", async function () {

    const { registry, owner, ethers } = await deployRegistry();

    const identityHash = ethers.keccak256(
      ethers.toUtf8Bytes("Stephen Ogalo identity")
    );

    await registry.registerIdentity(
      identityHash,
      "did:aiid:test123",
      "test-public-key"
    );

    expect(
      await registry.isIdentityActive(owner.address)
    ).to.equal(true);

    await registry.deactivateIdentity();

    expect(
      await registry.isIdentityActive(owner.address)
    ).to.equal(false);
  });

});
