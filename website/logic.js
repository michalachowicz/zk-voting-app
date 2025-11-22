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

async function switchToArbitrum() {
    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
    });
}

connectButton.addEventListener('click', async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await switchToArbitrum();
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    output.innerText = address;

    const blockNumber = await provider.getBlockNumber();

    output.innerText = `Address: ${address}\nActual block number: ${blockNumber}`;
});