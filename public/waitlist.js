// Uses the same on-chain counter contract as before (one signup per
// address) - reframed here as a waitlist rather than an upvote. The
// deployed contract's function is still named upvote()/totalUpvotes()
// on-chain (already verified under those names), this file just
// presents it to users as what it actually is: a real, unfakeable
// waitlist signup count.
const ABI = [
  "function upvote() external",
  "function totalUpvotes() view returns (uint256)",
  "function hasUpvoted(address) view returns (bool)",
  "error AlreadyUpvoted()",
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
    $("waitlistCount").textContent = `${count.toString()} on the waitlist`;
  } catch (e) {
    $("waitlistCount").textContent = "— on the waitlist";
  }
}

async function joinWaitlist() {
  const btn = $("waitlistBtn");
  if (!window.ethereum) {
    alert("Install a wallet extension (MetaMask, Trust Wallet, etc.) to join the waitlist on-chain.");
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

    btn.textContent = "You're on the list ✓";
    await loadCount();
  } catch (err) {
    if (String(err.reason || err.message || "").includes("AlreadyUpvoted")) {
      btn.textContent = "Already on the list ✓";
    } else {
      btn.textContent = originalText;
      btn.disabled = false;
      alert("Couldn't join the waitlist: " + (err.reason || err.shortMessage || err.message));
    }
  }
}

$("waitlistBtn").addEventListener("click", joinWaitlist);
loadCount();
