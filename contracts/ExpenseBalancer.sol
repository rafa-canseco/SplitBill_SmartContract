// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ExpenseBalancer is ReentrancyGuard, Ownable {
    IERC20 public stablecoin;
    enum SessionState { Pending, Active, AwaitingPayment, Completed }

    struct Session {
        address creator;
        address[] participants;
        mapping(address => bool) confirmedParticipants;
        mapping(address => int256) balances;
        mapping(address => bool) hasPaid;
        uint256 totalExpense;
        uint256 averageExpense;
        SessionState state;
        bool exists;
    }

    uint256 private sessionCounter;
    mapping(uint256 => Session) public sessions;

    event SessionCreated(uint256 indexed sessionId, address creator, address[] participants);
    event ParticipantJoined(uint256 indexed sessionId, address participant);
    event SessionStateChanged(uint256 indexed sessionId, SessionState newState);
    event PaymentMade(uint256 indexed sessionId, address payer, uint256 amount);
    event BalanceSettled(uint256 indexed sessionId, address to, uint256 amount);

    constructor(address _stablecoinAddress) Ownable(msg.sender) {
        stablecoin = IERC20(_stablecoinAddress);
    }

    function createSession(address[] memory _participants) external returns (uint256) {
        uint256 newSessionId = sessionCounter + 1;
        require(!sessions[newSessionId].exists, "Session creation failed");

        Session storage newSession = sessions[newSessionId];
        newSession.creator = msg.sender;
        newSession.participants = _participants;
        newSession.state = SessionState.Pending;
        newSession.exists = true;

        newSession.confirmedParticipants[msg.sender] = true;

        sessionCounter = newSessionId;

        emit SessionCreated(newSessionId, msg.sender, _participants);
        return newSessionId;
    }

    function sessionExists(uint256 _sessionId) public view returns (bool) {
        return sessions[_sessionId].exists;
    }

    function joinSession(uint256 _sessionId) external {
        Session storage session = sessions[_sessionId];
        require(session.exists, "Session does not exist");
        require(session.state == SessionState.Pending, "Session is not pending");

        bool isInvited = false;
        for (uint i = 0; i < session.participants.length; i++) {
            if (session.participants[i] == msg.sender) {
                isInvited = true;
                break;
            }
        }

        require(isInvited, "You are not invited to this session");
        require(!session.confirmedParticipants[msg.sender], "You have already joined this session");

        session.confirmedParticipants[msg.sender] = true;
        emit ParticipantJoined(_sessionId, msg.sender);

        if (allParticipantsJoined(_sessionId)) {
            session.state = SessionState.Active;
            emit SessionStateChanged(_sessionId, SessionState.Active);
        }
    }

    function allParticipantsJoined(uint256 _sessionId)  public view returns (bool) {
        Session storage session = sessions[_sessionId];
        for (uint i = 0; i < session.participants.length; i++) {
            if(!session.confirmedParticipants[session.participants[i]]) {
                return false;
            }
        }
        return true;
    }

    function checkout(uint256 _sessionId, uint256[] memory _expenses) external returns (int256[] memory) {
        Session storage session = sessions[_sessionId];
        require(session.exists, "Session does not exist");
        require(session.state == SessionState.Active, "Session is not active");
        require(isParticipant(_sessionId, msg.sender), "Only participants can checkout");
        require(_expenses.length == session.participants.length, "Expenses don't match participants");
    
        uint256 totalExpense = 0;
        for (uint i = 0; i < _expenses.length; i++) {
            totalExpense += _expenses[i];
        }
    
        uint256 averageExpense = totalExpense / session.participants.length;
        session.totalExpense = totalExpense;
        session.averageExpense = averageExpense;
    
        int256[] memory balances = new int256[](session.participants.length);
    
        for (uint i = 0; i < session.participants.length; i++) {
            address participant = session.participants[i];
            int256 balance = int256(_expenses[i]) - int256(averageExpense);
            session.balances[participant] = balance;
            balances[i] = balance;
            if (balance <= 0) {
                session.hasPaid[participant] = false;
            } else {
                session.hasPaid[participant] = true;
            }
        }
        session.state = SessionState.AwaitingPayment;
        emit SessionStateChanged(_sessionId, SessionState.AwaitingPayment);
    
        return balances;
    }

    function isParticipant(uint256 _sessionId, address _address) internal view returns (bool) {
        Session storage session = sessions[_sessionId];
        for (uint i = 0; i < session.participants.length; i++) {
            if (session.participants[i] == _address) {
                return true;
            }
        }
        return false;
    }
    function getParticipantBalance(uint256 _sessionId, address _participant) public view returns (int256) {
        Session storage session = sessions[_sessionId];
        require(session.exists, "Session does not exist");
        require(isParticipant(_sessionId, _participant), "Not a participant in this session");
        return session.balances[_participant];
    }

    function makePayment(uint256 _sessionId) external nonReentrant {
        Session storage session = sessions[_sessionId];
        require(session.exists, "Session does not exist");
        require(session.state == SessionState.AwaitingPayment, "Session is not awaiting payment");
        require(session.balances[msg.sender] < 0, "No payment required");
        require(!session.hasPaid[msg.sender], "Already paid");

        uint256 amountToPay = uint256(-session.balances[msg.sender]);
        require(stablecoin.transferFrom(msg.sender, address(this), amountToPay), "Transfer failed");

        session.hasPaid[msg.sender] = true;
        emit PaymentMade(_sessionId, msg.sender, amountToPay);

        if (allPaymentsMade(_sessionId)) {
            settleBalances(_sessionId);
        }
    }

    function allPaymentsMade(uint256 _sessionId) internal view returns (bool) {
        Session storage session = sessions[_sessionId];
        for (uint i = 0; i < session.participants.length; i++) {
            if (!session.hasPaid[session.participants[i]]) {
                return false;
            }
        }
        return true;
    }

    function settleBalances(uint256 _sessionId) internal {
        Session storage session = sessions[_sessionId];
        for (uint i = 0; i < session.participants.length; i++) {
            address participant = session.participants[i];
            if (session.balances[participant] > 0) {
                uint256 amountToReceive = uint256(session.balances[participant]);
                require(stablecoin.transfer(participant, amountToReceive), "Transfer failed");
                emit BalanceSettled(_sessionId, participant, amountToReceive);
            }
        }
        session.state = SessionState.Completed;
        emit SessionStateChanged(_sessionId, SessionState.Completed);
    }
}