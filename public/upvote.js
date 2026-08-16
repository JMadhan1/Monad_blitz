const ABI = [
  "function upvote() external",
  "function totalUpvotes() view returns (uint256)",
  "function hasUpvoted(address) view returns (bool)",
];

const $ = (id) => document.getElementById(id);
let deployment;

async function loadCount() {
  try {
    const res = await fetch("upvote-deployment.json", { cache: "no-store" });
    deployment = await res.json();
    const readProvider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz/");
    const contract = new ethers.Contract(deployment.address, ABI, readProvider);
    const count = await contract.totalUpvotes();
    $("upvoteCount").textContent = `${count.toString()} vote${count.toString() === "1" ? "" : "s"} so far`;
  } catch (e) {
    $("upvoteCount").textContent = "— votes so far";
  }
}

async function castUpvote() {
  const btn = $("upvoteBtn");
  if (!window.ethereum) {
    alert("Install a wallet extension (MetaMask, Trust Wallet, etc.) to upvote on-chain.");
    return;
  }
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "Confirm in wallet…";
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0x279f",
        chainName: "Monad Testnet",
        nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
        rpcUrls: ["https://testnet-rpc.monad.xyz/"],
        blockExplorerUrls: ["https://testnet.monadvision.com"],
      }],
    }).catch(() => {});

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(deployment.address, ABI, signer);

    btn.textContent = "Submitting…";
    const tx = await contract.upvote();
    await tx.wait();

    btn.textContent = "Upvoted ✓";
    await loadCount();
  } catch (err) {
    if (String(err.reason || err.message || "").includes("AlreadyUpvoted")) {
      btn.textContent = "Already upvoted ✓";
    } else {
      btn.textContent = originalText;
      btn.disabled = false;
      alert("Upvote failed: " + (err.reason || err.shortMessage || err.message));
    }
  }
}

$("upvoteBtn").addEventListener("click", castUpvote);
loadCount();
