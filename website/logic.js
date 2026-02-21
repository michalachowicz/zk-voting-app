const connectButton = document.getElementById('connectButton');
const addressBox = document.getElementById('addressBox');
const userIdBox = document.getElementById('userIdBox');
const userIdDisplay = document.getElementById('userIdDisplay');
const addVotingContainer = document.getElementById('addVotingContainer');
const votingsContainer = document.getElementById('votingsContainer');
const filterContainer = document.getElementById('filter-container')
const filterButtonAll = document.getElementById('buttonFilterAll');
const filterButtonWaiting = document.getElementById('buttonFilterWaiting');
const filterButtonCommit = document.getElementById('buttonFilterCommit');
const filterButtonReveal = document.getElementById('buttonFilterReveal');
const filterButtonEnded = document.getElementById('buttonFilterEnded');

let contractAddress, abi, provider, signer, contract, userSecret, userId, cachedVotingsData = [], filterStatus = "All";

async function switchToArbitrum() {
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
    });
}

async function copyUserId() {
    if (!userId) return;
    try {
        await navigator.clipboard.writeText(userId);
        showToast("User ID copied!", "success");
    } catch (err) {
        console.error(e);
        showToast("e", "error");
    }
};

async function loadContractData() {
    const [configRes, abiRes] = await Promise.all([
        fetch(`./config.json`),
        fetch(`./abi.json`),
    ]);

    const config = await configRes.json();
    const abi = await abiRes.json();

    return {
        address: config.votingAddress,
        abi: abi
    };
}

async function logIn() {
    try {
        const data = await loadContractData();
        contractAddress = data.address;
        abi = data.abi;
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

        contract = new ethers.Contract(contractAddress, abi, signer);

        const address = await signer.getAddress();

        connectButton.style.display = 'none';
        addressBox.style.display = "block";
        addressBox.innerText = address.slice(0, 6) + "..." + address.slice(-4);
        userIdBox.style.display = "block";
        userIdDisplay.innerText = userId.slice(0, 6) + "..." + userId.slice(-4);

        const owner = await contract.owner();
        if (address == owner) {
            generateAddVotingBox();
        }
        showToast("Logged in successfully!");
        await fetchProposals();
    }
    catch (e) {
        console.error(e);
        showToast(e.message, 'error');
    }
}

function generateAddVotingBox() {
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
                    <label class="info-label">Voting Question</label><br>
                    <input type="text" id="question" placeholder="Question">
                </div>

                <div class="input-group full-width">
                    <label class="info-label">Voting Options</label><br>
                    <div id="optionsContainer" class="options-container"></div>
                    <button id="addOptionButton" class="button-addOption">+ Add Option</button>
                </div>

            </div>
            <button id="addVotingButton" class="button">Add Voting</button>
        </div>
    </div>`

    addVotingContainer.insertAdjacentHTML("afterbegin", html);
    addVotingButton.addEventListener('click', addVoting);
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

async function fetchProposals() {
    const now = Math.floor(Date.now() / 1000);
    const votingsCount = await contract.votingsCount();
    votingsContainer.innerHTML = "";

    for (let i = votingsCount - 1; i >= 0; i--) {
        let [votingDetails, optionsRaw] = await Promise.all([contract.votingDetails(i), contract.getOptions(i)]);
        let results = {};
        if (now > votingDetails.commitmentEndTime) {}
            for (const opt of optionsRaw) {
                let count = await contract.votes(i, opt);
                results[opt] = count;
        };
        let votingData = {
            id: i,
            votingDetails: votingDetails,
            optionsRaw: optionsRaw,
            results: results
        }
        cachedVotingsData.push(votingData);
        renderVoting(votingData);
        if (i == votingsCount - 1) {
            const firstVisibleCard = votingsContainer.querySelector('.card');
            firstVisibleCard.classList.add('open');
        }
    }
}

async function fetchNewestVoting() {
    const votingId = await contract.votingsCount() - 1;
    let results = {};
    const [votingDetails, optionsRaw] = await Promise.all([contract.votingDetails(votingId), contract.getOptions(votingId)]);
    for (const opt of optionsRaw) {
        results[opt] = 0;
    };
    const votingData = {
        id: votingId,
        votingDetails: votingDetails,
        optionsRaw: optionsRaw,
        results: results
    }
    cachedVotingsData.unshift(votingData);
    renderVotings();
}

async function refreshVoting(votingId) {
    const [votingDetails, optionsRaw] = await Promise.all([contract.votingDetails(votingId), contract.getOptions(votingId)]);
    results = {};
    for (const opt of optionsRaw) {
        let count = await contract.votes(votingId, opt);
        results[opt] = count;
    }
    const votingData = {
        id: votingId,
        votingDetails: votingDetails,
        optionsRaw: optionsRaw,
        results: results
    }
    const index = cachedVotingsData.findIndex(value => value.id === votingId);
    cachedVotingsData[index] = votingData;
    const html = generateVotingHtml(votingData);
    const votingCard = document.getElementById(`card${votingId}`)
    votingCard.innerHTML = html;
    showToast(`Proposal ${votingId} refreshed!`)
}

function generateVotingHtml(votingData) {
    const now = Math.floor(Date.now() / 1000);
    let votingId = votingData.id;
    let votingDetails = votingData.votingDetails;
    let optionsRaw = votingData.optionsRaw;
    let results = votingData.results;
    let status = '';
    let resultsBadge = '';
    let commitDisabled = '';
    let revealDisabled = '';
    let commitDisabledClass = '';
    let revealDisabledClass = '';

    if (now < votingDetails.startTime) {
        statusHtml = `<span class="countdown-timer status-badge status-waiting" data-target="${votingDetails.startTime}" data-text="Starts">Waiting...</span>`;
        status = 'Waiting';
        commitDisabled = 'disabled';
        revealDisabled = 'disabled';
        commitDisabledClass = 'button-disabled';
        revealDisabledClass = 'button-disabled';
    } else if (now <= votingDetails.commitmentEndTime) {
        statusHtml = `<span class="countdown-timer status-badge status-commit" data-target="${votingDetails.commitmentEndTime}" data-text="Commit ends">Waiting...</span>`;
        status = 'Commit';
        revealDisabled = 'disabled';
        revealDisabledClass = 'button-disabled';
    } else if (now <= votingDetails.revealEndTime) {
        statusHtml = `<span class="countdown-timer status-badge status-reveal" data-target="${votingDetails.revealEndTime}" data-text="Reveal ends">Waiting...</span>`;
        status = 'Reveal';
        commitDisabled = 'disabled';
        commitDisabledClass = 'button-disabled';
        resultsBadge = '📊 Live Results';
    } else {
        statusHtml = `<span class="status-badge status-ended">🏁 Ended</span>`
        status = 'Ended';
        resultsBadge = '🏆 Final Results';
    }

    let selectHtml = '<option value="" disabled selected>Select Option</option>';

    let resultsHtml = '';
    for (const opt of optionsRaw) {
        let text;
        try {
            text = ethers.utils.parseBytes32String(opt);
        } catch (error) {
            text = opt;
        }

        selectHtml += `<option value="${text}">${text}</option>`;
        resultsHtml += `<div class="result-row"><span>${text}</span><b>${results[opt]}</b></div>`;
    };

    const resultsSectionHtml = (status === 'Reveal' || status === 'Ended') ?
        `<div class="results-box"><span class="info-label">${resultsBadge}</span>${resultsHtml}</div>` : '';
    const selectSectionHtml = (status != 'Ended') ?
        `<label class="info-label">Your Vote</label>
            <select id="vote-select-${votingId}" class="vote-select">${selectHtml}</select >` : '';
    const buttonSectionHtml = (status != 'Ended') ?
        `<div class="button-section">
            <button class="button ${commitDisabledClass}" onclick="commit(${votingId})" ${commitDisabled}>Commit</button>
            <button class="button ${revealDisabledClass}" onclick="reveal(${votingId})" ${revealDisabled}>Reveal</button>
        </div>` : '';
    const buttonRefresh = (status === 'Reveal') ?
        `<button class="button-refresh" title="Refresh data"
            onclick = "event.stopPropagation(); refreshVoting(${votingId})" >
            🔄
        </button > ` : '';


    const html = `
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <div class="card-title">Proposal #${votingId}</div>
            ${statusHtml}
            <div class="header-actions">
            ${buttonRefresh}
            <label class="arrow">▼</label>
            </div>
        </div>
        <div class="card-body">
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Start</span>
                    <span class="info-value">${formatTimestamp(votingDetails.startTime)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Commit End</span>
                    <span class="info-value">${formatTimestamp(votingDetails.commitmentEndTime)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Reveal End</span>
                    <span class="info-value">${formatTimestamp(votingDetails.revealEndTime)}</span>
                </div>
            </div>
            <div class="question-box">
                <span class="info-label">Proposal Question</span>
                <div class="question-text">
                    ${votingDetails.question} </div>
            </div>
            ${resultsSectionHtml}
            <div class="vote-section">
                ${selectSectionHtml}
                ${buttonSectionHtml}
            </div>

        </div>`;
    
    const hidden = (status != filterStatus && filterStatus != 'All') ? 'hidden' : '';

    return [html, hidden];
}

function renderVoting(votingData) {
    const [ votingHtml, hidden ] = generateVotingHtml(votingData);
    const html = `
        <div id="card${votingData.id}" class="card ${hidden}" data-id="${votingData.id}">
            ${votingHtml}
        </div>`;

    votingsContainer.insertAdjacentHTML('beforeend', html);
}

function renderVotings() {
    votingsContainer.innerHTML = "";
    for (const votingData of cachedVotingsData) {
        renderVoting(votingData);
    }
    const firstVisibleCard = votingsContainer.querySelector('.card:not(.hidden)');

    if (firstVisibleCard) {
        firstVisibleCard.classList.add('open');
    } else {
        votingsContainer.innerHTML = '<div class="empty-state">No votings match filter.</div>';
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
            const card = timer.closest('.card');
            const votingId = parseInt(card.dataset.id);
            const index = cachedVotingsData.findIndex(value => value.id === votingId);
            const votingData = cachedVotingsData[index];
            const [html, hidden] = generateVotingHtml(votingData);
            if (hidden == 'hidden')
                card.classList.add('hidden');
            else
                card.classList.remove('hidden');
            card.innerHTML = html;

        } else {
            const d = Math.floor(diff / (3600 * 24));
            const h = Math.floor((diff % (3600 * 24)) / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            timer.innerHTML = `${timer.dataset.text} In: ${d}d ${h}h ${m}m ${s}s`;
        }
    });
}

async function addVoting() {
    try {
        const startTime = document.getElementById('startTime');
        const commitEndTime = document.getElementById('commitEndTime');
        const revealEndTime = document.getElementById('revealEndTime');
        const merkleRoot = document.getElementById('merkleRoot');
        const question = document.getElementById('question');
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

        const tx = await contract.functions.addVoting(startTimestamp, commitEndTimestamp, revealEndTimestamp, merkleRoot.value, question.value, options_hex);
        showToast("Transaction sent...", "success");
        const receipt = await tx.wait();
        if (receipt.status === 1) {
            showToast("Voting added successfully!", "success");
            startTime.value = '';
            commitEndTime.value = '';
            revealEndTime.value = '';
            merkleRoot.value = '';
            question.value = '';
            document.getElementById('optionsContainer').innerHTML = '';
            addMandatoryOptionInput();
            addMandatoryOptionInput();
            await fetchNewestVoting();
        }
        else
            showToast("Transaction failed!", "Error");

        
    }
    catch (e) {
        console.error(e);
        showToast(e.reason || e.message, "error");
    }
}

async function findMerklePath(votingId) {
    const response = await fetch(`merkle_tree_${votingId}.txt`);

    if (!response.ok) {
        throw new Error("No file with Merkle Tree found!");
    }
    const text = await response.text();
    const merkleTree = text.split('\n');
    const indentifierIndex = merkleTree.findIndex(value => value === userId);
    if (indentifierIndex == -1) throw new Error('User is not eligible to vote!')
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

async function commit(votingId) {
    try {
        const optionText = document.getElementById(`vote-select-${votingId}`).value.trim();
        if (optionText == '') throw new Error('You have to choose the option!');
        const { path, sides } = await findMerklePath(votingId);
        const option = ethers.utils.formatBytes32String(optionText);
        let nullifier = window.poseidon([userSecret, votingId]);
        nullifier = window.poseidon.F.toObject(nullifier);
        nullifier = ethers.utils.hexZeroPad("0x" + nullifier.toString(16), 32);
        const nonce = await contract.nonces(votingId, nullifier);
        const message = SALT_MESSAGE.replace('{id}', votingId).replace('{nonce}', nonce);
        const salt = await signer.signMessage(message);
        const hashedSalt = ethers.utils.keccak256(salt);
        const commitmentEncoded = ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"], [option, hashedSalt]
        )
        const commitmentHashed = ethers.utils.keccak256(commitmentEncoded);
        const commitment = BigInt(commitmentHashed) >> 3n;
        
        const input = {
            secret: userSecret.toString(),
            pathElements: path,
            pathIndicators: sides,
            commitment: commitment,
            votingId: votingId.toString(),
            nonce: nonce.toString()
        };
        const commitmentHex = ethers.utils.hexZeroPad("0x" + commitment.toString(16), 32);
            
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "voting.wasm", "voting_final.zkey");
        const pA = proof.pi_a.slice(0, 2);
        const pB = [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ];
        const pC = proof.pi_c.slice(0, 2);

        const tx = await contract.functions.commit(pA, pB, pC, nullifier, commitmentHex, votingId.toString(), nonce.toString());
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

async function reveal(votingId) {
    try {
        const optionText = document.getElementById(`vote-select-${votingId}`).value.trim();
        if (optionText == '') throw new Error('You have to choose the option!');
        const option = ethers.utils.formatBytes32String(optionText);
        let nullifier = window.poseidon([userSecret, votingId]);
        nullifier = window.poseidon.F.toObject(nullifier);
        nullifier = ethers.utils.hexZeroPad("0x" + nullifier.toString(16), 32);
        const nonce = await contract.nonces(votingId, nullifier);
        const message = SALT_MESSAGE.replace('{id}', votingId).replace('{nonce}', nonce-1);
        const salt = await signer.signMessage(message);
        const hashedSalt = ethers.utils.keccak256(salt);
        const tx = await contract.functions.reveal(votingId, nullifier, option, hashedSalt);
        showToast("Transaction sent...", "success");
        const receipt = await tx.wait();
        if (receipt.status === 1) {
            showToast("Vote revealed successfully!", "success");
            refreshVoting(votingId);
        }
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
    setTimeout(() => div.remove(), 5000);
}

function setFilter(filter) {
    filterStatus = filter;
    renderVotings();
    document.querySelector(".button-filter.active").classList.remove('active');
    document.getElementById(`buttonFilter${filter}`).classList.add('active');
}

connectButton.addEventListener('click', logIn);
filterButtonAll.addEventListener('click', () => { setFilter("All") });
filterButtonWaiting.addEventListener('click', () => { setFilter("Waiting") });
filterButtonCommit.addEventListener('click', () => { setFilter("Commit") });
filterButtonReveal.addEventListener('click', () => { setFilter("Reveal") });
filterButtonEnded.addEventListener('click', () => { setFilter("Ended") });
