import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExpenseBalancer", function () {
  let expenseBalancer: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const usdcTestnet = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    const ExpenseBalancer = await ethers.getContractFactory("ExpenseBalancer");
    expenseBalancer = await ExpenseBalancer.deploy(usdcTestnet);
    await expenseBalancer.waitForDeployment();
  });

  describe("createSession", function () {
    it("Should create a session and emit SessionCreated event", async function () {
      const invitedParticipants = [addr1.address, addr2.address, addr3.address];

      await expect(expenseBalancer.createSession(invitedParticipants))
        .to.emit(expenseBalancer, "SessionCreated")
        .withArgs(1, owner.address, invitedParticipants);
    });

    it("Should create multiple sessions with incrementing IDs", async function () {
      const invitedParticipants = [addr1.address, addr2.address, addr3.address];

      await expect(expenseBalancer.createSession(invitedParticipants))
        .to.emit(expenseBalancer, "SessionCreated")
        .withArgs(1, owner.address, invitedParticipants);

      await expect(expenseBalancer.createSession(invitedParticipants))
        .to.emit(expenseBalancer, "SessionCreated")
        .withArgs(2, owner.address, invitedParticipants);
    });
  });

  describe("joinSession", function () {
    let sessionId: number;

    beforeEach(async function () {
      const invitedParticipants = [addr1.address, addr2.address, addr3.address];
      await expenseBalancer.createSession(invitedParticipants);
      sessionId = 1; // Assuming this is the first session
    });

    it("Should allow invited participants to join", async function () {
      await expect(expenseBalancer.connect(addr1).joinSession(sessionId))
        .to.emit(expenseBalancer, "ParticipantJoined")
        .withArgs(sessionId, addr1.address);
    });

    it("Should not allow non-invited participants to join", async function () {
      await expect(expenseBalancer.connect(owner).joinSession(sessionId))
        .to.be.revertedWith("You are not invited to this session");
    });

    it("Should not allow participants to join twice", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expect(expenseBalancer.connect(addr1).joinSession(sessionId))
        .to.be.revertedWith("You have already joined this session");
    });

    it("Should change session state to Active when all participants join", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expenseBalancer.connect(addr2).joinSession(sessionId);
      await expect(expenseBalancer.connect(addr3).joinSession(sessionId))
        .to.emit(expenseBalancer, "SessionStateChanged")
        .withArgs(sessionId, 1); // 1 represents SessionState.Active
    });
  });

  describe("allParticipantsJoined", function () {
    let sessionId: number;

    beforeEach(async function () {
      const invitedParticipants = [addr1.address, addr2.address, addr3.address];
      await expenseBalancer.createSession(invitedParticipants);
      sessionId = 1; // Assuming this is the first session
    });

    it("Should return false when not all participants have joined", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expenseBalancer.connect(addr2).joinSession(sessionId);
      expect(await expenseBalancer.allParticipantsJoined(sessionId)).to.be.false;
    });

    it("Should return true when all participants have joined", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expenseBalancer.connect(addr2).joinSession(sessionId);
      await expenseBalancer.connect(addr3).joinSession(sessionId);
      expect(await expenseBalancer.allParticipantsJoined(sessionId)).to.be.true;
    });
  });

  describe("sessionExists", function () {
    it("Should return false for non-existent session", async function () {
      expect(await expenseBalancer.sessionExists(1)).to.be.false;
    });

    it("Should return true for existing session", async function () {
      const invitedParticipants = [addr1.address, addr2.address, addr3.address];
      await expenseBalancer.createSession(invitedParticipants);
      expect(await expenseBalancer.sessionExists(1)).to.be.true;
    });
  });

  describe("checkout and getParticipantBalance", function () {
    let sessionId: number;

    beforeEach(async function () {
      const participants = [await addr1.getAddress(), await addr2.getAddress(), await addr3.getAddress()];
      await expenseBalancer.createSession(participants);
      sessionId = 1;
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expenseBalancer.connect(addr2).joinSession(sessionId);
      await expenseBalancer.connect(addr3).joinSession(sessionId);
    });

    it("Should set correct balances after checkout", async function () {
      const expenses = [ethers.parseUnits("100", 6), ethers.parseUnits("50", 6), ethers.parseUnits("70", 6)];
      await expenseBalancer.connect(addr1).checkout(sessionId, expenses);
  
      const balance1 = await expenseBalancer.getParticipantBalance(sessionId, await addr1.getAddress());
      const balance2 = await expenseBalancer.getParticipantBalance(sessionId, await addr2.getAddress());
      const balance3 = await expenseBalancer.getParticipantBalance(sessionId, await addr3.getAddress());
  

      expect(Number(ethers.formatUnits(balance1, 6))).to.be.closeTo(26.66, 0.01);
      expect(Number(ethers.formatUnits(balance2, 6))).to.be.closeTo(-23.33, 0.01);
      expect(Number(ethers.formatUnits(balance3, 6))).to.be.closeTo(-3.33, 0.01);
  

      const totalBalance = balance1 + balance2 + balance3;
      expect(Math.abs(Number(ethers.formatUnits(totalBalance, 6)))).to.be.lessThanOrEqual(0.01);
    })
  });
  
  
});