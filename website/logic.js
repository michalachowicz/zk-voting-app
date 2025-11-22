const connectButton = document.getElementById('connectButton');
const getRoundsButton = document.getElementById('getRoundsButton');
const output = document.getElementById('output');

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

async function getRounds() {
    const roundsCount = await contract.roundsCount();
    console.log(roundsCount);

    roundsContainer.innerHTML = "";

    for (let i=0; i < roundsCount; i++) {
        let roundDetails = await contract.roundDetails(i);
        let options = await contract.getOptions(i);
        console.log(roundDetails);

        const html = `
                <fieldset>
                    <legend><strong>Round #${i}</strong></legend>
                    
                    Start: ${roundDetails.startTime}<br>
                    Commit End: ${roundDetails.commitmentEndTime}<br>
                    Reveal End: ${roundDetails.revealEndTime}<br>
                    Root: ${roundDetails.merkleRoot}<br>
                    Options: ${options}
                </fieldset>
                <br> `;

        roundsContainer.insertAdjacentHTML('beforeend', html);
    }
}

connectButton.addEventListener('click', logIn);
getRoundsButton.addEventListener('click', getRounds);