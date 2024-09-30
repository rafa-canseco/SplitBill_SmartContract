// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ExpenseBalancer is ReentrancyGuard, Ownable {
    IERC20 public stablecoin;
    enum SessionState { Pending,Active, AwaitingPayment, Completed }

    struct Session {
        address creator;
        address[]invitedParticipants;
        mapping(address => bool) confirmedParticipants;
        mapping(address => int256) balances;
        SessionState state;
        bool exists;
    }

    mapping(uint256 => Session) public sessions;

    event SessionCreated(uint256 indexed sessionId, address creator, address[] invitedParticipants);
    event ParticipantJoined(uint256 indexed sessionId, address participant);
    event SessionStateChanged(uint256 indexed sessionId, SessionState newState);
    event PaymentMade(uint256 indexed sessionId, address payer, uint256 amount);
    event BalanceRedistributed(uint256 indexed sessionId, address from, address to, uint256 amount);

    constructor(address _stablecoinAddress) Ownable(msg.sender) {
        stablecoin = IERC20(_stablecoinAddress);
    }

    function createSession(uint256 _sessionId,address[] memory _invitedParticipants) external {
        require(!sessions[_sessionId].exists, "Session with this ID already exists");

        Session storage newSession = sessions[_sessionId];
        newSession.creator = msg.sender;
        newSession.invitedParticipants = _invitedParticipants;
        newSession.state = SessionState.Pending;
        newSession.exists = true;

        newSession.confirmedParticipants[msg.sender] = true;

        emit SessionCreated(_sessionId, msg.sender, _invitedParticipants);
    }

    function joinSession(uint256 _sessionId) external {
        Session storage session = sessions[_sessionId];
        require(session.exists, "Session does not exist");
        require(session.state == SessionState.Pending, "Session is not pending");

        bool isInvited = false;
        for (uint i =0; i < session.invitedParticipants.length; i++) {
            if (session.invitedParticipants[i] == msg.sender) {
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
        for (uint i = 0; i < session.invitedParticipants.length; i++) {
            if(!session.confirmedParticipants[session.invitedParticipants[i]]) {
                return false;
            }
        }
        return true;
    }
}
