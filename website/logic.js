const connectButton = document.getElementById('connectButton');
const addressBox = document.getElementById('addressBox');
const addRoundContainer = document.getElementById('addRoundContainer');
const roundsContainer = document.getElementById('roundsContainer');

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

    connectButton.style.display = 'none';
    addressBox.style.display = "block";
    addressBox.innerText = address.slice(0, 6) + "..." + address.slice(-4);
    if (address == owner) {
        generateAddRoundBox();
    }
    await getRounds();
}

function generateAddRoundBox() {
    const html = `
    <div class="card card-admin open">
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <div class="card-title">Admin Panel</div>
            <label class="arrow">▼</label>
        </div>
        <div class="card-body">
            <div class="admin-grid">

                <div class="input-group">
                    <label class="info-label">Voting Start</label><br>
                    <input type="text" id="startTime" class="date-picker" placeholder="Select Date & Time">
                </div>

                <div class="input-group">
                    <label class="info-label">Commit End</label><br>
                    <input type="text" id="commitEndTime" class="date-picker" placeholder="Select Date & Time">
                </div>

                <div class="input-group">
                    <label class="info-label">Reveal End</label><br>
                    <input type="text" id="revealEndTime" class="date-picker" placeholder="Select Date & Time">
                </div>

                <div class="input-group full-width">
                    <label class="info-label">Merkle Root</label><br>
                    <input type="text" id="merkleRoot" placeholder="Merkle Root (Hex)">
                </div>

                <div class="input-group full-width">
                    <label class="info-label">Voting Options</label><br>
                    <input type="text" id="options" placeholder="Options">
                </div>

            </div>
            <button id="addRoundButton" class="button">Add Round</button>
        </div>
    </div>`

    addRoundContainer.insertAdjacentHTML("afterbegin", html);
    addRoundButton.addEventListener('click', addRound);

    flatpickr(".date-picker", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        minDate: "today"
    });
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

        let selectHtml = '<option value="" disabled selected>Select Option</option>';
        options.forEach(opt => {
            selectHtml += `<option value="${opt}">${opt}</option>`;
        });


        const html = `
        <div class="card">
            <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
                <div class="card-title">Round #${i}</div>
                <label class="arrow">▼</label>
            </div>
            <div class="card-body">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Start</span>
                        <span class="info-value">${formatTimestamp(roundDetails.startTime)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Commit End</span>
                        <span class="info-value">${formatTimestamp(roundDetails.commitmentEndTime)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Reveal End</span>
                        <span class="info-value">${formatTimestamp(roundDetails.revealEndTime)}</span>
                    </div>
                </div>
                <div class="vote-section">
                    <label class="info-label">Your Vote</label>
                    <select id="vote-select-${i}" class="vote-select">${selectHtml}</select >
                    <div class="button-section">
                        <button class="button" onclick="commit(${i})">Commit</button>
                        <button class="button" onclick="reveal(${i})">Reveal</button>
                    </div>
                </div>
            </div>
        </div>`;

        roundsContainer.insertAdjacentHTML('beforeend', html);
    }
}

async function addRound() {
    const startTime = document.getElementById('startTime');
    const commitEndTime = document.getElementById('commitEndTime');
    const revealEndTime = document.getElementById('revealEndTime');
    const merkleRoot = document.getElementById('merkleRoot');
    const options = document.getElementById('options');
    
    console.log(startTime, commitEndTime, revealEndTime);
    const startTimestamp = Math.floor(new Date(startTime.value).getTime() / 1000);
    const commitEndTimestamp = Math.floor(new Date(commitEndTime.value).getTime() / 1000);
    const revealEndTimestamp = Math.floor(new Date(revealEndTime.value).getTime() / 1000);
    console.log(startTimestamp, commitEndTimestamp, revealEndTimestamp);
    const options_hex = options.value.split(',').map(item => ethers.utils.formatBytes32String(item.trim()));
    await contract.functions.addRound(startTimestamp, commitEndTimestamp, revealEndTimestamp, merkleRoot.value, options_hex);
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

async function commit(roundId) {
    const optionText = document.getElementById(`vote-select-${roundId}`).value.trim();
    const option = ethers.utils.formatBytes32String(optionText);
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
    await contract.functions.commit(pA, pB, pC, nullifier, commitmentHex, roundId.toString(), nonce.toString());
}

async function reveal(roundId) {
    const optionText = document.getElementById(`vote-select-${roundId}`).value.trim();
    const option = ethers.utils.formatBytes32String(optionText);
    let nullifier = window.poseidon([userSecret, roundId]);
    nullifier = window.poseidon.F.toObject(nullifier);
    nullifier = ethers.utils.hexZeroPad("0x" + nullifier.toString(16), 32);
    const salt = await signer.signMessage(SALT_MESSAGE + roundId.toString());
    const hashedSalt = ethers.utils.keccak256(salt);
    await contract.functions.reveal(option, nullifier, roundId, hashedSalt);
}

connectButton.addEventListener('click', logIn);

