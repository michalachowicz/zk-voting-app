const connectButton = document.getElementById('connectButton');
const getRoundsButton = document.getElementById('getRoundsButton');
const output = document.getElementById('output');
const startTime = document.getElementById('startTime')
const commitEndTime = document.getElementById('commitEndTime')
const revealEndTime = document.getElementById('revealEndTime')
const merkleRoot = document.getElementById('merkleRoot')
const options = document.getElementById('options')

let provider, signer, contract, userSecret;

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
    userSecret = ethers.utils.keccak256(signature);

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    console.log('signature: ', signature);
    console.log(userSecret);
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

connectButton.addEventListener('click', logIn);
getRoundsButton.addEventListener('click', getRounds);
addRoundButton.addEventListener('click', addRound);