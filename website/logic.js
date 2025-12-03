const connectButton = document.getElementById('connectButton');
const addressBox = document.getElementById('addressBox');
const addRoundContainer = document.getElementById('addRoundContainer');
const roundsContainer = document.getElementById('roundsContainer');

let provider, signer, contract, userSecret, userId, cachedRoundsData = [];

async function switchToArbitrum() {
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
    });
}

async function logIn() {
    try {
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
        showToast("Logged in successfully!");
        await fetchRounds();
    }
    catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
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
                    <div id="optionsContainer" class="options-container"></div>
                    <button id="addOptionButton" class="button-addOption">+ Add Option</button>
                </div>

            </div>
            <button id="addRoundButton" class="button">Add Round</button>
        </div>
    </div>`

    addRoundContainer.insertAdjacentHTML("afterbegin", html);
    addRoundButton.addEventListener('click', addRound);
    addOptionButton.addEventListener('click', addOptionInput);

    flatpickr(".date-picker", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        minDate: "today"
    });

    addMandatoryOptionInput();
    addMandatoryOptionInput();
}

function addOptionInput() {
    const optionsContainer = document.getElementById('optionsContainer');
    const div = document.createElement('div');
    div.className = 'option-row';

    div.innerHTML = `
        <input type="text" class="option-input" placeholder="Enter option">
        <button class="button-removeOption" onclick="this.parentElement.remove()">X</button>
    `;

    optionsContainer.appendChild(div);
}

function addMandatoryOptionInput() {
    const optionsContainer = document.getElementById('optionsContainer');
    const div = document.createElement('div');
    div.className = 'option-row';

    div.innerHTML = `
        <input type="text" class="option-input" placeholder="Enter option">
    `;

    optionsContainer.appendChild(div);
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

async function fetchRounds() {
    const now = Math.floor(Date.now() / 1000);
    const roundsCount = await contract.roundsCount();
    roundsContainer.innerHTML = "";

    for (let i = roundsCount - 1; i >= 0; i--) {
        let [roundDetails, optionsRaw] = await Promise.all([contract.roundDetails(i), contract.getOptions(i)]);
        let results = {};
        if (now > roundDetails.commitmentEndTime) {}
            for (let opt of optionsRaw) {
                let count = await contract.votes(i, opt);
                results[opt] = count;
        };
        let roundData = {
            id: i,
            roundDetails: roundDetails,
            optionsRaw: optionsRaw,
            results: results
        }
        cachedRoundsData.push(roundData);
        renderRound(roundData);
    }
    console.log(cachedRoundsData);
}

function renderRound(roundData) {
    const now = Math.floor(Date.now() / 1000);
    let roundId = roundData.id;
    let roundDetails = roundData.roundDetails;
    let optionsRaw = roundData.optionsRaw;
    let results = roundData.results;
    let status = '';
    let resultsBadge = '';
    let commitDisabled = '';
    let revealDisabled = '';
    let commitDisabledClass = '';
    let revealDisabledClass = '';

    if (now < roundDetails.startTime) {
        statusHtml = `<span class="countdown-timer status-badge status-waiting" data-target="${roundDetails.startTime}"></span>`;
        status = 'waiting';
        commitDisabled = 'disabled';
        revealDisabled = 'disabled';
        commitDisabledClass = 'button-disabled';
        revealDisabledClass = 'button-disabled';
    } else if (now <= roundDetails.commitmentEndTime) {
        statusHtml = `<span class="status-badge status-commit">Commit Phase</span>`
        status = 'commit';
        revealDisabled = 'disabled';
        revealDisabledClass = 'button-disabled';
    } else if (now <= roundDetails.revealEndTime) {
        statusHtml = `<span class="status-badge status-reveal">Reveal Phase</span>`
        status = 'reveal';
        commitDisabled = 'disabled';
        commitDisabledClass = 'button-disabled';
        resultsBadge = '📊 Live Results';
    } else {
        statusHtml = `<span class="status-badge status-ended">🏁 Ended</span>`
        status = 'ended';
        resultsBadge = '🏆 Final Results';
    }

    let selectHtml = '<option value="" disabled selected>Select Option</option>';

    let resultsHtml = '';
    for (let opt of optionsRaw) {
        let text;
        try {
            text = ethers.utils.parseBytes32String(opt);
        } catch (error) {
            text = opt;
        }

        selectHtml += `<option value="${text}">${text}</option>`;
        resultsHtml += `<div class="result-row"><span>${text}</span><b>${results[opt]}</b></div>`;
    };

    const resultsSectionHtml = (status === 'reveal' || status === 'ended') ?
        `<div class="results-box"><span class="info-label">${resultsBadge}</span>${resultsHtml}</div>` : '';
    const selectSectionHtml = (status != 'ended') ?
        `<label class="info-label">Your Vote</label>
            <select id="vote-select-${roundId}" class="vote-select">${selectHtml}</select >` : '';
    const buttonSectionHtml = (status != 'ended') ?
        `<div class="button-section">
            <button class="button ${commitDisabledClass}" onclick="commit(${roundId})" ${commitDisabled}>Commit</button>
            <button class="button ${revealDisabledClass}" onclick="reveal(${roundId})" ${revealDisabled}>Reveal</button>
        </div>` : '';


    const html = `
        <div class="card">
            <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
                <div class="card-title">Round #${roundId}</div>
                ${statusHtml}
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
                ${resultsSectionHtml}
                <div class="vote-section">
                    ${selectSectionHtml}
                    ${buttonSectionHtml}
                </div>
            </div>
        </div>`;

    roundsContainer.insertAdjacentHTML('beforeend', html);
    if (roundsContainer.children.length == 1) {
        roundsContainer.getElementsByClassName('card')[0].classList.toggle('open');
    }
}

function renderRounds() {
    roundsContainer.innerHTML = "";
    for (let roundData of cachedRoundsData) {
        renderRound(roundData);
    }
}

setInterval(updateCountdowns, 1000);
function updateCountdowns() {
    const timers = document.querySelectorAll('.countdown-timer');
    const now = Math.floor(Date.now() / 1000);
    timers.forEach(timer => {
        const target = parseInt(timer.dataset.target);
        const diff = target - now;
        if (diff <= 0) {
            timer.innerHTML = "Starting...";
            renderRounds();
        } else {
            const d = Math.floor(diff / (3600 * 24));
            const h = Math.floor((diff % (3600 * 24)) / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            timer.innerHTML = `⏳ In: ${d}d ${h}h ${m}m ${s}s`;
        }
    });
}

async function addRound() {
    try {
        const startTime = document.getElementById('startTime');
        const commitEndTime = document.getElementById('commitEndTime');
        const revealEndTime = document.getElementById('revealEndTime');
        const merkleRoot = document.getElementById('merkleRoot');
        const optionInputs = document.querySelectorAll('.option-input');

        if (startTime.value == '' || commitEndTime.value == '' || revealEndTime.value == '')
            throw new Error('All date fields are required!');
        if (!ethers.utils.isHexString(merkleRoot.value, 32)) {
            throw new Error("Invalid Merkle Root! It must be a 32-byte Hex string");
        }
        
        const startTimestamp = Math.floor(new Date(startTime.value).getTime() / 1000);
        const commitEndTimestamp = Math.floor(new Date(commitEndTime.value).getTime() / 1000);
        const revealEndTimestamp = Math.floor(new Date(revealEndTime.value).getTime() / 1000);

        const options = [];
        optionInputs.forEach(option => {
            if (option.value.trim() !== "") {
                options.push(option.value.trim());
            }
        });
        const options_hex = options.map(option => ethers.utils.formatBytes32String(option));

        const tx = await contract.functions.addRound(startTimestamp, commitEndTimestamp, revealEndTimestamp, merkleRoot.value, options_hex);
        showToast("Transaction sent...", "success");
        const receipt = await tx.wait();
        if (receipt.status === 1)
            showToast("Round added successfully!", "success");
        else
            showToast("Transaction failed!", "Error");

        startTime.value = '';
        commitEndTime.value = '';
        revealEndTime.value = '';
        merkleRoot.value = '';
        document.getElementById('optionsContainer').innerHTML = '';
        addMandatoryOptionInput();
        addMandatoryOptionInput();
        console.log('Round added')
        await fetchRound();
    }
    catch (e) {
        console.error(e);
        showToast(e.reason || e.message, "error");
    }
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
    if (indentifierIndex == -1) throw new Error('User is not eligible to vote!')
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
    try {
        const optionText = document.getElementById(`vote-select-${roundId}`).value.trim();
        if (optionText == '') throw new Error('You have to choose the option!');
        const { path, sides } = await findMerklePath();
        console.log(path);
        console.log(sides);
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
        const tx = await contract.functions.commit(pA, pB, pC, nullifier, commitmentHex, roundId.toString(), nonce.toString());
        showToast("Transaction sent...", "success");
        const receipt = await tx.wait();
        if (receipt.status === 1)
            showToast("Vote commited successfully!", "success");
        else
            showToast("Transaction failed!", "Error");
    }
    catch (e) {
        console.error(e);
        showToast(e.reason || e.message, "error");
    }
}

async function reveal(roundId) {
    try {
        const optionText = document.getElementById(`vote-select-${roundId}`).value.trim();
        if (optionText == '') throw new Error('You have to choose the option!');
        const option = ethers.utils.formatBytes32String(optionText);
        let nullifier = window.poseidon([userSecret, roundId]);
        nullifier = window.poseidon.F.toObject(nullifier);
        nullifier = ethers.utils.hexZeroPad("0x" + nullifier.toString(16), 32);
        const salt = await signer.signMessage(SALT_MESSAGE + roundId.toString());
        const hashedSalt = ethers.utils.keccak256(salt);
        const tx = await contract.functions.reveal(option, nullifier, roundId, hashedSalt);
        showToast("Transaction sent...", "success");
        const receipt = await tx.wait();
        if (receipt.status === 1)
            showToast("Vote revealed successfully!", "success");
        else
            showToast("Transaction failed!", "Error");
    }
    catch (e) {
        console.error(e);
        showToast(e.reason || e.message, "error");
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `<b>${type === 'success' ? 'Success' : 'Error'}</b><br>${msg}`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

connectButton.addEventListener('click', logIn);

