const connectButton = document.getElementById('connectButton');
const output = document.getElementById('output');

const ARBITRUM_CHAIN_ID = '0xa4b1';
const ARBITRUM_CONFIG = {
    chainId: ARBITRUM_CHAIN_ID,
    chainName: 'Arbitrum One',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io/']
};

const LOGIN_MESSAGE = "Sign this message to generate user secret"
let userSecret;

async function switchToArbitrum() {
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
    });
}

async function logIn() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await switchToArbitrum();
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(LOGIN_MESSAGE);
    console.log('signature: ', signature);
    userSecret = ethers.keccak256(signature);
    console.log(userSecret);
    const address = await signer.getAddress();
    output.innerText = address;

    const blockNumber = await provider.getBlockNumber();

    output.innerText = `Address: ${address}\nActual block number: ${blockNumber}`;
}

connectButton.addEventListener('click', async () => logIn());