// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "./verifier.sol";

contract Voting {

    address public owner;
    struct VotingData {
        uint startTime;
        uint commitmentEndTime;
        uint revealEndTime;
        bytes32 merkleRoot;
        string question;
        bytes32[] options;
    }

    enum VoteState {
        None,
        Committed,
        Revealed
    }

    event VotingAdded(uint indexed votingId, uint start, uint commitmentEnd, uint revealEnd);
    event Committed(uint indexed votingId, bytes32 indexed nullifier, bytes32 commitment, uint nonce);
    event Revealed(uint indexed votingId, bytes32 indexed nullifier, bytes32 option);

    Groth16Verifier immutable public verifier;
    uint public votingsCount = 0;
    mapping (uint => VotingData) public votingDetails;
    mapping (uint => mapping(bytes32 => uint)) public votes;
    mapping (uint => uint) public totalCommits;
    mapping (uint => uint) public totalRevealedVotes;
    mapping (uint => mapping(bytes32 => VoteState)) public state;
    mapping (uint => mapping(bytes32 => bool)) public isOption;
    mapping (uint => mapping(bytes32 => bytes32)) public commitments;
    mapping (uint => mapping(bytes32 => uint)) public nonces;


    constructor(address _verifier) {
        owner = msg.sender;
        verifier = Groth16Verifier(_verifier);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Address is not the owner!");
        _;
    }   

    function changeOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Address cannot be zero!");
        owner = newOwner;
    }

    function addVoting(
        uint startTime, uint commitmentEndTime, uint revealEndTime, 
        bytes32 merkleRoot, 
        string calldata question, bytes32[] calldata options
    ) external onlyOwner {

        require(startTime > block.timestamp, "startTime must be in future");
        require(commitmentEndTime > startTime, "Commit end must be > start");
        require(revealEndTime > commitmentEndTime, 
            "Reveal end must be > commit end");
        require(bytes(question).length > 0, "Question is required");
        require(options.length > 1, "At least 2 options are required");

        for (uint i = 0; i < options.length; i++) {
            require(!isOption[votingsCount][options[i]], "Duplicated option");
            isOption[votingsCount][options[i]] = true;
        }

        votingDetails[votingsCount] = VotingData(
            startTime, commitmentEndTime, revealEndTime, 
            merkleRoot, question, options);

        votingsCount++;
        emit VotingAdded(
            votingsCount - 1, startTime, commitmentEndTime, revealEndTime);
    }


    function commit(
        uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, 
        bytes32 _nullifier, bytes32 _commitment, uint _votingId, uint _nonce
    ) external{

        require(_votingId < votingsCount, "Voting does not exist!");

        VotingData storage voting = votingDetails[_votingId];
        require(block.timestamp >= voting.startTime,
            "Committing has not started yet!");
        require(block.timestamp <= voting.commitmentEndTime,
            "Committing has ended!");
        require(_nonce == nonces[_votingId][_nullifier], "Invalid nonce!");

        uint[5] memory pub = [
            uint(voting.merkleRoot), uint(_nullifier), 
            uint(_commitment), _votingId, _nonce
        ];
        require(verifier.verifyProof(_pA, _pB, _pC, pub), "Invalid proof!");

        commitments[_votingId][_nullifier] = _commitment;
        if (state[_votingId][_nullifier] == VoteState.None)
            totalCommits[_votingId]++;
        state[_votingId][_nullifier] = VoteState.Committed;
        nonces[_votingId][_nullifier]++;

        emit Committed(_votingId, _nullifier, _commitment, _nonce);
    }

    function reveal(
        uint _votingId, bytes32 _nullifier, bytes32 _option, bytes32 _salt
    ) external {

        require(_votingId < votingsCount, "Voting does not exist!");

        VotingData storage voting = votingDetails[_votingId];
        require(block.timestamp > voting.commitmentEndTime, 
            "Revealing has not started yet!");
        require(block.timestamp <= voting.revealEndTime, 
            "Revealing has ended!");
        require(state[_votingId][_nullifier] != VoteState.None, 
            "User has not committed!");
        require(state[_votingId][_nullifier] != VoteState.Revealed, 
            "User has already revealed!");
        require(isOption[_votingId][_option], "Invalid option!");

        // Adjust keccak output to BN254 field
        require(
            uint(commitments[_votingId][_nullifier]) == 
            uint(keccak256(abi.encode(_option, _salt))) >> 3, 
            "Invalid commitment!"
        );

        votes[_votingId][_option]++;
        state[_votingId][_nullifier] = VoteState.Revealed;
        totalRevealedVotes[_votingId]++;
        emit Revealed(_votingId, _nullifier, _option);
    }

    function getOptions(uint _votingId) external view returns (bytes32[] memory) {
        return votingDetails[_votingId].options;
    }

}