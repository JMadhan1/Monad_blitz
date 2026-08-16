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

/* ---- wallet discovery (EIP-6963, same pattern as app.js) ---------------------------------------- */
const discoveredWallets = new Map();
window.addEventListener("eip6963:announceProvider", (event) => {
  discoveredWallets.set(event.detail.info.uuid, event.detail);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

function getWalletProvider() {
  const wallets = [...discoveredWallets.values()];
  if (wallets.length > 0) return wallets[0].provider;
  if (window.ethereum) return window.ethereum;
  return null;
}

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
  const walletProvider = getWalletProvider();
  if (!walletProvider) {
    alert("Install a wallet extension (MetaMask, Trust Wallet, etc.) to join the waitlist on-chain.");
    return;
  }
  btn.disabled = true;
  btn.classList.remove("btn-pulse");
  const originalText = btn.textContent;
  btn.textContent = "Confirm in wallet…";
  try {
    await walletProvider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0x279f",
        chainName: "Monad Testnet",
        nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
        rpcUrls: ["https://testnet-rpc.monad.xyz/"],
        blockExplorerUrls: ["https://testnet.monadvision.com"],
      }],
    }).catch(() => {});

    const provider = new ethers.BrowserProvider(walletProvider);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(deployment.address, ABI, signer);

    btn.textContent = "Submitting…";
    const tx = await contract.upvote();
    await tx.wait();

    btn.textContent = "You're on the list ✓";
    btn.classList.remove("btn-pulse");
    await loadCount();
  } catch (err) {
    if (String(err.reason || err.message || "").includes("AlreadyUpvoted")) {
      btn.textContent = "Already on the list ✓";
      btn.classList.remove("btn-pulse");
    } else {
      btn.textContent = originalText;
      btn.disabled = false;
      btn.classList.add("btn-pulse");
      alert("Couldn't join the waitlist: " + (err.reason || err.shortMessage || err.message));
    }
  }
}

$("waitlistBtn").addEventListener("click", joinWaitlist);
loadCount();
