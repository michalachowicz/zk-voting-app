const connectButton = document.getElementById('connectButton');
const getRoundsButton = document.getElementById('getRoundsButton');
const output = document.getElementById('output');
const roundsContainer = document.getElementById('roundsContainer');
const startTime = document.getElementById('startTime');
const commitEndTime = document.getElementById('commitEndTime');
const revealEndTime = document.getElementById('revealEndTime');
const merkleRoot = document.getElementById('merkleRoot');
const options = document.getElementById('options');
const addRoundButton = document.getElementById('addRoundButton');
const findPathButton = document.getElementById('findPathButton');
const choosedOption = document.getElementById('choosedOption');
const commitButton = document.getElementById('commitButton')

let provider, signer, contract, userSecret, userId;

async function switchToArbitrum() {
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
    });
}

async function logIn() {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await switchToArbitrum();

    signer = await provider.getSigner();
    const signature = await signer.signMessage(LOGIN_MESSAGE);
    userSecret = window.poseidon([signature]);
    userSecret = window.poseidon.F.toObject(userSecret);
    userId = window.poseidon([userSecret]);
    userId = window.poseidon.F.toObject(userId);
    userId = ethers.utils.hexZeroPad("0x" + userId.toString(16), 32);

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    console.log('signature: ', signature);
    console.log("secret: ", userSecret);
    console.log("ID: ", userId)
    console.log(contract.address);
    const owner = await contract.owner();
    console.log(owner);

    const address = await signer.getAddress();
    output.innerText = address;
    const blockNumber = await provider.getBlockNumber();
    output.innerText = `Address: ${address}\nCurrent block number: ${blockNumber}`;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp.toNumber() * 1000);

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

async function getRounds() {
    const roundsCount = await contract.roundsCount();
    console.log(roundsCount);

    roundsContainer.innerHTML = "";

    for (let i=0; i < roundsCount; i++) {
        let roundDetails = await contract.roundDetails(i);
        console.log(roundDetails);
        let optionsRaw = await contract.getOptions(i);
        let options = optionsRaw.map(item => {
            try {
                return ethers.utils.parseBytes32String(item);
            } catch (error) {
                return item;
            }
        });


        const html = `
                <fieldset>
                    <legend><strong>Round #${i}</strong></legend>
                    
                    Start: ${formatTimestamp(roundDetails.startTime)}<br>
                    Commit End: ${formatTimestamp(roundDetails.commitmentEndTime)}<br>
                    Reveal End: ${formatTimestamp(roundDetails.revealEndTime)}<br>
                    Root: ${roundDetails.merkleRoot}<br>
                    Options: ${options}
                </fieldset>
                <br> `;

        roundsContainer.insertAdjacentHTML('beforeend', html);
    }
}

async function addRound() {
    const options_hex = options.value.split(',').map(item => ethers.utils.formatBytes32String(item.trim()));
    await contract.functions.addRound(startTime.value, commitEndTime.value, revealEndTime.value, merkleRoot.value, options_hex);
    startTime.value = '';
    commitEndTime.value = '';
    revealEndTime.value = '';
    merkleRoot.value = '';
    options.value = '';
    console.log('Round added')
}

async function findMerklePath() {
    const response = await fetch('merkle_tree.txt');

    if (!response.ok) {
        throw new Error("No file with Merkle Tree found!");
    }

    const text = await response.text();
    const merkleTree = text.split('\n');
    console.log(merkleTree);
    const indentifierIndex = merkleTree.findIndex(value => value === userId);
    console.log(indentifierIndex);
    let path = [];
    let sides = [];
    let currentIndex = indentifierIndex;
    while (currentIndex > 0) {
        if (currentIndex % 2 === 0) {
            path.push(merkleTree[currentIndex - 1]);
            sides.push(1);
        }
        else {
            path.push(merkleTree[currentIndex + 1]);
            sides.push(0);
        }
        currentIndex = Math.floor((currentIndex - 1) / 2);
    }
    return { path, sides };
}

async function commit() {
    const roundId = await contract.roundsCount() - 1;
    const option = ethers.utils.formatBytes32String("tak");
    let nullifier = window.poseidon([userSecret, roundId]);
    nullifier = window.poseidon.F.toObject(nullifier);
    nullifier = ethers.utils.hexZeroPad("0x" + nullifier.toString(16), 32);
    const salt = await signer.signMessage(SALT_MESSAGE + roundId.toString());
    const hashedSalt = ethers.utils.keccak256(salt);
    const commitmentEncoded = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "uint", "bytes32"], [option, nullifier, roundId, hashedSalt]
    )
    const commitmentHashed = ethers.utils.keccak256(commitmentEncoded);
    console.log(commitmentHashed);
    const commitment = BigInt(commitmentHashed) % P;
    const nonce = await contract.nonces(roundId, nullifier);
    const { path, sides } = await findMerklePath();
    console.log(path);
    console.log(sides);
    const input = {
        secret: userSecret.toString(),
        siblings: path,
        sides: sides,
        commitment: commitment,
        roundId: roundId.toString(),
        nonce: nonce.toString()
    };
    const commitmentHex = ethers.utils.hexZeroPad("0x" + commitment.toString(16), 32);
    console.log("secret: ", userSecret.toString());
    console.log("path: ", path);
    console.log("sides: ", sides);
    console.log("commitment: ", commitmentHex);
    console.log("roundId: ", roundId.toString());
    console.log("nonce: ", nonce.toString());
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "voting.wasm", "voting_final.zkey");
    console.log("public: ", publicSignals);
    const pA = proof.pi_a.slice(0, 2);
    const pB = [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]
    ];
    const pC = proof.pi_c.slice(0, 2);

    console.log("nullifier: ", nullifier);
    contract.functions.commit(pA, pB, pC, nullifier, commitmentHex, roundId.toString(), nonce.toString());
}

connectButton.addEventListener('click', logIn);
getRoundsButton.addEventListener('click', getRounds);
addRoundButton.addEventListener('click', addRound);
findPathButton.addEventListener('click', findMerklePath);
commitButton.addEventListener('click', commit);
