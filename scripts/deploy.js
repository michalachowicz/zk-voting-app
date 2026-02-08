import hre from "hardhat";
import fs from "fs";

async function main() {
    const networkName = hre.network.name;
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deploying to network: ${networkName}`);
    console.log(`Deploying contracts with account: ${deployer.address}`);

    const VerifierFactory = await hre.ethers.getContractFactory("Groth16Verifier");
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();

    console.log(`Verifier contract deployed at: ${verifierAddress}`);

    const VotingFactory = await hre.ethers.getContractFactory("Voting");
    const voting = await VotingFactory.deploy(verifierAddress);
    await voting.waitForDeployment();
    const votingAddress = await voting.getAddress();

    console.log(`Voting contract deployed at: ${votingAddress}`);

    const config = {
        votingAddress: votingAddress,
        verifierAddress: verifierAddress
    };

    fs.writeFileSync("website/config.json", JSON.stringify(config));
    console.log(`Voting contract address saved in website/config.json`);

    const artifactContent = fs.readFileSync("build/artifacts/contracts/voting.sol/Voting.json", "utf-8");
    const artifactJson = JSON.parse(artifactContent);
    fs.writeFileSync("website/abi.json", JSON.stringify(artifactJson.abi, null, 2));
    console.log(`Voting contract abi saved in website/abi.json`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});