const connectButton = document.getElementById('connectButton');
const output = document.getElementById('output');

connectButton.addEventListener('click', async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    output.innerText = address;

    const blockNumber = await provider.getBlockNumber();

    output.innerText = `Address: ${address}\nActual block number: ${blockNumber}`;
});