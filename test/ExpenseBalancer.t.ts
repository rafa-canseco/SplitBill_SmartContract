import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExpenseBalancer", function () {
  let expenseBalancer: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;
  let mockStablecoin: any;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const usdcTestnet = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    const ExpenseBalancer = await ethers.getContractFactory("ExpenseBalancer");
    expenseBalancer = await ExpenseBalancer.deploy(usdcTestnet);
    await expenseBalancer.waitForDeployment();
  });

  describe("createSession", function () {
    it("Should create a session", async function () {
      const sessionId = 1;
      const invitedParticipants = [addr1.address, addr2.address];

      await expect(
        expenseBalancer.createSession(sessionId, invitedParticipants)
      )
        .to.emit(expenseBalancer, "SessionCreated")
        .withArgs(sessionId, owner.address, invitedParticipants);

      const sessionExists = await expenseBalancer.sessions(sessionId);
      expect(sessionExists.exists).to.be.true;
    });
    it("Should not allow creating a session with an existing ID", async function () {
      const sessionId = 1;
      const invitedParticipants = [await addr1.getAddress(), await addr2.getAddress()];

      await expenseBalancer.createSession(sessionId, invitedParticipants);

      await expect(expenseBalancer.createSession(sessionId, invitedParticipants))
        .to.be.revertedWith("Session with this ID already exists");
    });
     });
  describe("joinSession", function () {
    const sessionId = 1;
    let invitedParticipants: string[];

    beforeEach(async function () {
      invitedParticipants = [await addr1.getAddress(), await addr2.getAddress()];
      await expenseBalancer.createSession(sessionId, invitedParticipants);
    });

    it("Should allow invited participants to join", async function () {
      await expect(expenseBalancer.connect(addr1).joinSession(sessionId))
        .to.emit(expenseBalancer, "ParticipantJoined")
        .withArgs(sessionId, await addr1.getAddress());
    });

    it("Should not allow non-invited participants to join", async function () {
      await expect(expenseBalancer.connect(addr3).joinSession(sessionId))
        .to.be.revertedWith("You are not invited to this session");
    });

    it("Should not allow participants to join twice", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expect(expenseBalancer.connect(addr1).joinSession(sessionId))
        .to.be.revertedWith("You have already joined this session");
    });

    it("Should change session state to Active when all participants join", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expect(expenseBalancer.connect(addr2).joinSession(sessionId))
        .to.emit(expenseBalancer, "SessionStateChanged")
        .withArgs(sessionId, 1); 
    });
  });

  describe("allParticipantsJoined", function () {
    const sessionId = 1;
    let invitedParticipants: string[];

    beforeEach(async function () {
      invitedParticipants = [await addr1.getAddress(), await addr2.getAddress()];
      await expenseBalancer.createSession(sessionId, invitedParticipants);
    });

    it("Should return false when not all participants have joined", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      expect(await expenseBalancer.allParticipantsJoined(sessionId)).to.be.false;
    });

    it("Should return true when all participants have joined", async function () {
      await expenseBalancer.connect(addr1).joinSession(sessionId);
      await expenseBalancer.connect(addr2).joinSession(sessionId);
      expect(await expenseBalancer.allParticipantsJoined(sessionId)).to.be.true;
    });
  });
  });

