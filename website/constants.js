const ARBITRUM_CHAIN_ID = '0xa4b1';
const LOGIN_MESSAGE = "Sign this message to generate user secret"
const SALT_MESSAGE = "Sign this message to generate salt for your commit for voting - RoundId: "
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const CONTRACT_ADDRESS = "0xd53a88883646e2EFdFdeF5566C6A1CDe8f2Be30c";
const CONTRACT_ABI = [
    "function commitments(uint256, bytes32) view returns (bytes32)",
    "function getOptions(uint256 _roundId) view returns (bytes32[])",
    "function isOption(uint256, bytes32) view returns (bool)",
    "function nonces(uint256, bytes32) view returns (uint256)",
    "function owner() view returns (address)",
    "function roundDetails(uint256) view returns (uint256 startTime, uint256 commitmentEndTime, uint256 revealEndTime, bytes32 merkleRoot)",
    "function roundsCount() view returns (uint256)",
    "function state(uint256, bytes32) view returns (uint8)",
    "function totalCommits(uint256) view returns (uint256)",
    "function totalRevealedVotes(uint256) view returns (uint256)",
    "function votes(uint256, bytes32) view returns (uint256)",

    "function addRound(uint256 startTime, uint256 commitmentEndTime, uint256 revealEndTime, bytes32 merkleRoot, bytes32[] options)",
    "function changeOwnership(address newOwner)",
    "function commit(uint256[2] _pA, uint256[2][2] _pB, uint256[2] _pC, bytes32 _nullifier, bytes32 _commit, uint256 _roundId, uint256 _nonce)",
    "function reveal(bytes32 _option, bytes32 _nullifier, uint256 _roundId, bytes32 _salt)",
];
