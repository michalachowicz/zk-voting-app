import { expect } from "chai";
import hre from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import * as snarkjs from "snarkjs";
import path from "path";
import { fileURLToPath } from 'url';

const { ethers } = hre;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFullProof(inputs) {
    const wasmPath = path.join(__dirname, "../build/merkle_proof_js/merkle_proof.wasm");
    const zkeyPath = path.join(__dirname, "../build/merkle_proof_0001.zkey");

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        wasmPath,
        zkeyPath
    );

    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const argv = JSON.parse("[" + calldata + "]");

    return {
        pA: argv[0],
        pB: argv[1],
        pC: argv[2],
        pubSignals: argv[3]
    };
}

describe("Voting contract tests", function () {
    const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    function generateCommitment(optionBytes32, saltBytes32) {
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "bytes32"],
            [optionBytes32, saltBytes32]
        );
        const hashBigInt = BigInt(ethers.keccak256(encoded));
        return ethers.toBeHex(hashBigInt % P, 32);
    }

    async function deployVotingMock() {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const MockVerifierFactory = await ethers.getContractFactory("MockVerifier");
        const verifier = await MockVerifierFactory.deploy();
        const VotingFactory = await ethers.getContractFactory("Voting");
        const voting = await VotingFactory.deploy(verifier.target);
        return { voting, verifier, owner, addr1, addr2 };
    }

    async function deployVotingReal() {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
        const verifier = await VerifierFactory.deploy();
        const Voting = await ethers.getContractFactory("Voting");
        const voting = await Voting.deploy(verifier.target);

        return { voting, verifier, owner, addr1, addr2 };
    }

    describe("changeOwnership", function () {
        it("Should fail if changing to zero address", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.changeOwnership(ethers.ZeroAddress))
                .to.be.revertedWith("Address cannot be zero!");
        });

        it("Should change ownership to a regular address", async function () {
            const { voting, addr1 } = await loadFixture(deployVotingMock);
            await voting.changeOwnership(addr1.address);
            expect(await voting.owner()).to.equal(addr1.address);
        });

        it("Should fail if non-owner tries to change ownership", async function () {
            const { voting, addr1, addr2 } = await loadFixture(deployVotingMock);
            await expect(
                voting.connect(addr1).changeOwnership(addr2.address)
            ).to.be.revertedWith("Address is not the owner!");
        });
    });

    describe("addVoting", function () {
        let now, startTime, commitEnd, revealEnd;
        const root = ethers.ZeroHash;
        const question = "?";
        const options = [ethers.encodeBytes32String("Tak"), ethers.encodeBytes32String("Nie")];

        beforeEach(async function () {
            now = await time.latest();
            startTime = now + 100;
            commitEnd = now + 1000;
            revealEnd = now + 2000;
        });

        it("Should fail if non-owner tries to add a voting", async function () {
            const { voting, addr1 } = await loadFixture(deployVotingMock);

            await expect(
                voting.connect(addr1).addVoting(
                    startTime, commitEnd, revealEnd,
                    ethers.ZeroHash, question, options
                )
            ).to.be.revertedWith("Address is not the owner!");
        });

        it("Should fail if start time is in the past", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(now-10, commitEnd, revealEnd, root, question, options))
                .to.be.revertedWith("startTime must be in future");
        });

        it("Should fail if commitmentEndTime <= startTime", async function () {
            const { voting }  = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(startTime, startTime, revealEnd, root, question, options))
                .to.be.revertedWith("Commit end must be > start");
        });

        it("Should fail if revealEndTime <= commitmentEndTime", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(startTime, commitEnd, commitEnd, root, question, options))
                .to.be.revertedWith("Reveal end must be > commit end");
        });

        it("Should fail if question is empty", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(startTime, commitEnd, revealEnd, root, "", options))
                .to.be.revertedWith("Question is required");
        });

        it("Should fail if there is only 1 option", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(startTime, commitEnd, revealEnd, root, question, [options[0]]))
                .to.be.revertedWith("At least 2 options are required");
        });

        it("Should fail if options are identical", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(startTime, commitEnd, revealEnd, root, question, [options[0], options[0]]))
                .to.be.revertedWith("Duplicated option");
        });

        it("Should create voting successfully with correct parameters", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            await expect(voting.addVoting(startTime, commitEnd, revealEnd, root, question, options))
                .to.emit(voting, "VotingAdded");
        });
    });

    describe("commit", function () {
        let voting, startTime, commitEnd, revealEnd;
        const pA = [0, 0], pB = [[0, 0], [0, 0]], pC = [0, 0];

        beforeEach(async function () {
            ({ voting } = await loadFixture(deployVotingMock));
            const now = await time.latest();
            startTime = now + 100;
            commitEnd = now + 1000;
            revealEnd = now + 2000;
            await voting.addVoting(startTime, commitEnd, revealEnd, ethers.ZeroHash, "?",
                [ethers.encodeBytes32String("A"), ethers.encodeBytes32String("B")]);
        });

        it("Should fail for non-existent votingID", async function () {
            await expect(voting.commit(pA, pB, pC, ethers.ZeroHash, ethers.ZeroHash, 1, 0))
                .to.be.revertedWith("Voting does not exist!");
        });

        it("Should fail before start time", async function () {
            await time.increaseTo(startTime - 10);
            await expect(voting.commit(pA, pB, pC, ethers.ZeroHash, ethers.ZeroHash, 0, 0))
                .to.be.revertedWith("Committing has not started yet!");
        });

        it("Should fail after commitmentEndTime", async function () {
            await time.increaseTo(commitEnd + 1);
            await expect(voting.commit(pA, pB, pC, ethers.ZeroHash, ethers.ZeroHash, 0, 0))
                .to.be.revertedWith("Committing has ended!");
        });

        it("Should fail with future nonce", async function () {
            await time.increaseTo(startTime + 1);
            await expect(voting.commit(pA, pB, pC, ethers.ZeroHash, ethers.ZeroHash, 0, 1))
                .to.be.revertedWith("Invalid nonce!");
        });

        it("Should allow valid commit", async function () {
            await time.increaseTo(startTime + 1);
            await expect(voting.commit(pA, pB, pC, ethers.ZeroHash, ethers.ZeroHash, 0, 0))
                .to.emit(voting, "Committed");
        });

        it("Should fail with already used nonce", async function () {
            await time.increaseTo(startTime + 1);
            const nullifier = ethers.hexlify(ethers.randomBytes(32));
            await voting.commit(pA, pB, pC, nullifier, ethers.ZeroHash, 0, 0);
            await expect(voting.commit(pA, pB, pC, nullifier, ethers.ZeroHash, 0, 0))
                .to.be.revertedWith("Invalid nonce!");
        });

        it("Should not increase totalCommits if user commits again with same nullifier", async function () {
            await time.increaseTo(startTime + 1);
            const nullifier = ethers.hexlify(ethers.randomBytes(32));
            await voting.commit(pA, pB, pC, nullifier, ethers.ZeroHash, 0, 0);
            const countAfterFirst = await voting.totalCommits(0);

            await voting.commit(pA, pB, pC, nullifier, ethers.ZeroHash, 0, 1);
            const countAfterSecond = await voting.totalCommits(0);

            expect(countAfterFirst).to.equal(1);
            expect(countAfterSecond).to.equal(1);
        });
    });

    describe("reveal", function () {
        let voting, startTime, commitEnd, revealEnd;
        let optA, salt, nullifier, commitment;
        const pA = [0, 0], pB = [[0, 0], [0, 0]], pC = [0, 0];

        beforeEach(async function () {
            ({ voting } = await loadFixture(deployVotingMock));
            const now = await time.latest();
            startTime = now + 100;
            commitEnd = now + 1000;
            revealEnd = now + 2000;
            optA = ethers.encodeBytes32String("A");
            salt = ethers.hexlify(ethers.randomBytes(32));
            nullifier = ethers.hexlify(ethers.randomBytes(32));
            commitment = generateCommitment(optA, salt);

            await voting.addVoting(startTime, commitEnd, revealEnd, ethers.ZeroHash, "?", [optA, ethers.encodeBytes32String("B")]);
        });

        it("Should fail reveal for non-existent votingID", async function () {
            await expect(
                voting.reveal(1, nullifier, ethers.ZeroHash, ethers.ZeroHash)
            ).to.be.revertedWith("Voting does not exist!");
        });

        it("Should fail before reveal phase starts", async function () {
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);
            await expect(voting.reveal(0, nullifier, optA, salt))
                .to.be.revertedWith("Revealing has not started yet!");
        });

        it("Should fail after revealEndTime", async function () {
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);
            await time.increaseTo(revealEnd + 1);
            await expect(voting.reveal(0, nullifier, optA, salt))
                .to.be.revertedWith("Revealing has ended!");
        });

        it("Should fail if user did not commit", async function () {
            await time.increaseTo(commitEnd + 1);
            await expect(voting.reveal(0, nullifier, optA, salt))
                .to.be.revertedWith("User has not committed!");
        });

        it("Should fail with incorrect option", async function () {
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);
            await time.increaseTo(commitEnd + 1);
            const wrongOpt = ethers.encodeBytes32String("B");
            await expect(voting.reveal(0, nullifier, wrongOpt, salt))
                .to.be.revertedWith("Invalid commitment!");
        });

        it("Should fail with incorrect salt", async function () {
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);
            await time.increaseTo(commitEnd + 1);
            const wrongSalt = ethers.hexlify(ethers.randomBytes(32));
            await expect(voting.reveal(0, nullifier, optA, wrongSalt))
                .to.be.revertedWith("Invalid commitment!");
        });

        it("Should reveal successfully", async function () {
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);
            await time.increaseTo(commitEnd + 1);
            await expect(voting.reveal(0, nullifier, optA, salt))
                .to.emit(voting, "Revealed");
            expect(await voting.votes(0, optA)).to.equal(1);
        });

        it("Should fail if already revealed", async function () {
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);
            await time.increaseTo(commitEnd + 1);
            await voting.reveal(0, nullifier, optA, salt);
            await expect(voting.reveal(0, nullifier, optA, salt))
                .to.be.revertedWith("User has already revealed!");
        });

        it("Should fail reveal with an option that was not registered in the voting", async function () {
            const fakeOpt = ethers.encodeBytes32String("C");
            await time.increaseTo(startTime + 1);
            await voting.commit(pA, pB, pC, nullifier, commitment, 0, 0);

            await time.increaseTo(commitEnd + 1);
            await expect(
                voting.reveal(0, nullifier, fakeOpt, salt)
            ).to.be.revertedWith("Invalid option!");
        });
    });

    describe("getOption", function () {
        it("Should return correct options", async function () {
            const { voting } = await loadFixture(deployVotingMock);
            const optA = ethers.encodeBytes32String("A");
            const optB = ethers.encodeBytes32String("B");
            const now = await time.latest();
            await voting.addVoting(now + 100, now + 1000, now + 2000, ethers.ZeroHash, "?", [optA, optB]);

            const options = await voting.getOptions(0);
            expect(options[0]).to.equal(optA);
            expect(options[1]).to.equal(optB);
        });
    });

    describe("Real ZK-Proof", function () {
        let voting, verifier, startTime;
        let validInputs;
        const levels = 3;

        beforeEach(async function () {
            ({voting, verifier} = await loadFixture(deployVotingReal));

            const now = await time.latest();
            startTime = now + 100;

            const optA = ethers.encodeBytes32String("Tak");
            const secret = ethers.hexlify(ethers.randomBytes(32));
            const salt = ethers.hexlify(ethers.randomBytes(32));
            const commitment = generateCommitment(optA, salt);
            const pathElements = Array(levels).fill(0);
            const pathIndicators = Array(levels).fill(0);

            validInputs = {
                secret: BigInt(secret),
                pathElements: pathElements,
                pathIndicators: pathIndicators,
                commitment: BigInt(commitment),
                votingId: BigInt(0),
                nonce: BigInt(0)
            };


            const { pubSignals } = await generateFullProof(validInputs);
            const calculatedRoot = ethers.toBeHex(pubSignals[0], 32);

            await voting.addVoting(
                startTime,
                startTime + 1000,
                startTime + 2000,
                calculatedRoot,
                "?",
                [optA, ethers.encodeBytes32String("Nie")]
            );

            await time.increaseTo(startTime + 1);
        });

        it("Should commit successfully with a real proof", async function () {
            const { pA, pB, pC, pubSignals } = await generateFullProof(validInputs);
            const nullifier = ethers.toBeHex(pubSignals[1], 32);
            const commitment = ethers.toBeHex(pubSignals[2], 32);

            await expect(voting.commit(pA, pB, pC, nullifier, commitment, 0, 0))
                .to.emit(voting, "Committed");
        });

        it("Should fail with changed commitment", async function () {
            const { pA, pB, pC, pubSignals } = await generateFullProof(validInputs);
            const nullifier = ethers.toBeHex(pubSignals[1], 32);
            const fakeCommitment = ethers.toBeHex(999n, 32);

            await expect(
                voting.commit(pA, pB, pC, nullifier, fakeCommitment, 0, 0)
            ).to.be.revertedWith("Invalid proof!");
        });

        it("Should fail if proof is generated for a different votingId", async function () {
            const badInputs = { ...validInputs, votingId: 1n };
            const { pA, pB, pC, pubSignals } = await generateFullProof(badInputs);

            const nullifier = ethers.toBeHex(pubSignals[1], 32);
            const commitment = ethers.toBeHex(pubSignals[2], 32);

            await expect(
                voting.commit(pA, pB, pC, nullifier, commitment, 0, 0)
            ).to.be.revertedWith("Invalid proof!");
        });

        it("Should fail if proof is generated for a different nonce", async function () {
            const badInputs = { ...validInputs, nonce: 1n };
            const { pA, pB, pC, pubSignals } = await generateFullProof(badInputs);

            const nullifier = ethers.toBeHex(pubSignals[1], 32);
            const commitment = ethers.toBeHex(pubSignals[2], 32);

            await expect(
                voting.commit(pA, pB, pC, nullifier, commitment, 0, 0)
            ).to.be.revertedWith("Invalid proof!");
        });

        it("Should fail if user is not in the tree", async function () {
            const badInputs = { ...validInputs, secret: ethers.hexlify(ethers.randomBytes(32)) };
            const { pA, pB, pC, pubSignals } = await generateFullProof(badInputs);
            const nullifier = ethers.toBeHex(pubSignals[1], 32);
            const commitment = ethers.toBeHex(pubSignals[2], 32);

            await expect(
                voting.commit(pA, pB, pC, nullifier, commitment, 0, 0)
            ).to.be.revertedWith("Invalid proof!");
        });
    });
});