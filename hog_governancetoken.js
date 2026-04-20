const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HOG_GovernanceToken", function () {
  let hog;
  let deployer, daoShell, member1, member2, stranger;

  beforeEach(async function () {
    [deployer, daoShell, member1, member2, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HOG_GovernanceToken");
    hog = await Factory.deploy(deployer.address);
    await hog.waitForDeployment();
  });

  describe("Deployment", function () {
    it("has correct name and symbol", async function () {
      expect(await hog.name()).to.equal("House of Gronli Governance");
      expect(await hog.symbol()).to.equal("HOG");
    });

    it("starts with zero total supply", async function () {
      expect(await hog.totalSupply()).to.equal(0);
    });
  });

  describe("issueVotingToken()", function () {
    it("mints 1e18 to a new member", async function () {
      await hog.issueVotingToken(member1.address);
      expect(await hog.balanceOf(member1.address)).to.equal(ethers.parseEther("1"));
      expect(await hog.hasVotingToken(member1.address)).to.be.true;
    });

    it("auto-delegates to self", async function () {
      await hog.issueVotingToken(member1.address);
      expect(await hog.delegates(member1.address)).to.equal(member1.address);
      expect(await hog.getVotes(member1.address)).to.equal(ethers.parseEther("1"));
    });

    it("reverts for duplicate issuance", async function () {
      await hog.issueVotingToken(member1.address);
      await expect(
        hog.issueVotingToken(member1.address)
      ).to.be.revertedWithCustomError(hog, "AlreadyHoldsToken");
    });

    it("stranger cannot issue tokens", async function () {
      await expect(
        hog.connect(stranger).issueVotingToken(member2.address)
      ).to.be.reverted;
    });
  });

  describe("burnVotingToken()", function () {
    beforeEach(async function () {
      await hog.issueVotingToken(member1.address);
    });

    it("burns the member's token", async function () {
      await hog.burnVotingToken(member1.address);
      expect(await hog.balanceOf(member1.address)).to.equal(0);
      expect(await hog.hasVotingToken(member1.address)).to.be.false;
    });

    it("reverts if member has no token", async function () {
      await expect(
        hog.burnVotingToken(member2.address)
      ).to.be.revertedWithCustomError(hog, "DoesNotHoldToken");
    });
  });

  describe("Non-transferability", function () {
    beforeEach(async function () {
      await hog.issueVotingToken(member1.address);
    });

    it("transfer() reverts", async function () {
      await expect(
        hog.connect(member1).transfer(member2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(hog, "NonTransferable");
    });

    it("transferFrom() reverts", async function () {
      await expect(
        hog.connect(member1).transferFrom(
          member1.address, member2.address, ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(hog, "NonTransferable");
    });

    it("approve() reverts", async function () {
      await expect(
        hog.connect(member1).approve(member2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(hog, "NonTransferable");
    });
  });

  describe("Role transfer to DAO shell", function () {
    it("can grant MINTER_ROLE to DAO shell and renounce deployer's role", async function () {
      const MINTER_ROLE = await hog.MINTER_ROLE();
      await hog.grantRole(MINTER_ROLE, daoShell.address);
      await hog.renounceRole(MINTER_ROLE, deployer.address);

      expect(await hog.hasRole(MINTER_ROLE, daoShell.address)).to.be.true;
      expect(await hog.hasRole(MINTER_ROLE, deployer.address)).to.be.false;

      // DAO shell can now mint
      await hog.connect(daoShell).issueVotingToken(member1.address);
      expect(await hog.balanceOf(member1.address)).to.equal(ethers.parseEther("1"));
    });
  });
});