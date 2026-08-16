import { buildPoseidon } from "https://cdn.jsdelivr.net/npm/circomlibjs@0.1.7/+esm";
import { EthereumProvider } from "https://esm.sh/@walletconnect/ethereum-provider@2";
import BlindCapAgent from "./agent/simple-agent.js";

// Get a free project ID at https://dashboard.reown.com — required for the
// mobile "scan to connect" wallet option. Browser-extension wallets
// (MetaMask, Trust Wallet, etc.) work without this.
const REOWN_PROJECT_ID = "REPLACE_WITH_YOUR_REOWN_PROJECT_ID";

const MONAD_TESTNET = {
  chainId: "0x279f", // 10143
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz/"],
  blockExplorerUrls: ["https://testnet.monadvision.com"],
};

const REGISTRY_ABI = [
  "function registerPolicy(uint256 agentId, uint256 committedRoot) external",
  "function validationRequest(uint256 agentId, uint256 requestedAmount) external returns (bytes32)",
  "function validationResponse(bytes32 requestHash, uint[2] pA, uint[2][2] pB, uint[2] pC) external",
  "function getValidationStatus(bytes32 requestHash) external view returns (uint8)",
  "event ValidationRequested(bytes32 indexed requestHash, uint256 indexed agentId, uint256 requestedAmount)",
];
const IDENTITY_ABI = ["function register(uint256 agentId, address owner) external"];

const $ = (id) => document.getElementById(id);
const AGENT_ID = 1;
const SECRET_POLICY_KEY = "424242424242";
const MAX_LIMIT = "1000";
const EXPLORER = "https://testnet.monadvision.com/tx/";

let provider, signer, poseidon, deployment;
let committedRoot;
let agent;

/* ---- multi-wallet discovery (EIP-6963) ---------------------------------------- */

const discoveredWallets = new Map();

window.addEventListener("eip6963:announceProvider", (event) => {
  discoveredWallets.set(event.detail.info.uuid, event.detail);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

let wcProvider = null;

async function connectWalletConnect() {
  if (REOWN_PROJECT_ID === "REPLACE_WITH_YOUR_REOWN_PROJECT_ID") {
    alert("Mobile wallet connect isn't configured yet — get a free project ID at dashboard.reown.com and add it to app.js.");
    return null;
  }
  if (!wcProvider) {
    wcProvider = await EthereumProvider.init({
      projectId: REOWN_PROJECT_ID,
      chains: [10143],
      optionalChains: [10143],
      rpcMap: { 10143: "https://testnet-rpc.monad.xyz/" },
      showQrModal: true,
      metadata: {
        name: "Blind Cap",
        description: "Prove you can afford it. Reveal nothing.",
        url: window.location.origin,
        icons: [],
      },
    });
  }
  await wcProvider.connect();
  return wcProvider;
}

function pickWallet() {
  return new Promise((resolve) => {
    const browserWallets = [...discoveredWallets.values()];
    const overlay = $("walletPicker");
    const list = $("walletList");
    list.innerHTML = "";

    for (const w of browserWallets) {
      const btn = document.createElement("button");
      btn.className = "wallet-option";
      btn.innerHTML = `<img src="${w.info.icon}" alt="" /><span>${w.info.name}</span>`;
      btn.addEventListener("click", () => {
        overlay.hidden = true;
        resolve(w.provider);
      });
      list.appendChild(btn);
    }

    // Legacy fallback: a wallet that injects window.ethereum but doesn't
    // announce itself via EIP-6963 yet.
    if (browserWallets.length === 0 && window.ethereum) {
      const btn = document.createElement("button");
      btn.className = "wallet-option";
      btn.innerHTML = `<span class="wallet-option-icon">◆</span><span>Browser Wallet</span>`;
      btn.addEventListener("click", () => {
        overlay.hidden = true;
        resolve(window.ethereum);
      });
      list.appendChild(btn);
    }

    const wcBtn = document.createElement("button");
    wcBtn.className = "wallet-option";
    wcBtn.innerHTML = `<span class="wallet-option-icon">📱</span><span>Mobile Wallet — scan with WalletConnect</span>`;
    wcBtn.addEventListener("click", async () => {
      overlay.hidden = true;
      const p = await connectWalletConnect();
      resolve(p);
    });
    list.appendChild(wcBtn);

    overlay.hidden = false;
    $("walletPickerCancel").onclick = () => {
      overlay.hidden = true;
      resolve(null);
    };
  });
}

/* ---- console log helpers ---------------------------------------- */

function clearLog(el) {
  el.innerHTML = "";
  el.dataset.empty = "true";
}

function logLine(el, msg, kind) {
  el.dataset.empty = "false";
  const line = document.createElement("div");
  if (kind) line.className = "line-" + kind;
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function logTx(el, label, hash) {
  el.dataset.empty = "false";
  const line = document.createElement("div");
  line.className = "line-tx";
  const a = document.createElement("a");
  a.href = EXPLORER + hash;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = `${label} → ${hash.slice(0, 10)}…${hash.slice(-6)}`;
  line.appendChild(a);
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

/* ---- stage state ---------------------------------------- */

function setStage(id, state, pillText) {
  const section = $(id);
  section.dataset.state = state;
  const pill = $(id + "Pill");
  if (pill && pillText) pill.textContent = pillText;
}

/* ---- deployment + connect ---------------------------------------- */

async function loadDeployment() {
  const res = await fetch("deployment.json", { cache: "no-store" });
  deployment = await res.json();
  $("contractRow").innerHTML = `<span class="mono account-addr">ZKSpendAuth <code>${deployment.zkSpendAuth}</code></span>`;
  if (deployment.deployTx) {
    $("verifiedLink").innerHTML = `<a href="${EXPLORER}${deployment.deployTx}" target="_blank" rel="noopener">view deployment</a>`;
  }
}

async function connect() {
  const chosen = await pickWallet();
  if (!chosen) return;

  try {
    await chosen.request({
      method: "wallet_addEthereumChain",
      params: [MONAD_TESTNET],
    });
  } catch (e) {
    /* chain may already be added */
  }
  provider = new ethers.BrowserProvider(chosen);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  const addr = await signer.getAddress();
  $("account").textContent = addr;
  $("setupBtn").disabled = false;
  $("netDot").classList.add("live");

  setStage("stage1", "done", "connected");
  setStage("stage2", "active", "ready");

  poseidon = await buildPoseidon();
}

async function setupPolicy() {
  const setupLog = $("setupLog");
  clearLog(setupLog);
  try {
    const ownerAddr = await signer.getAddress();

    logLine(setupLog, "Registering agent identity…", "dim");
    const identity = new ethers.Contract(deployment.identityRegistry, IDENTITY_ABI, signer);
    const tx1 = await identity.register(AGENT_ID, ownerAddr);
    await tx1.wait();
    logTx(setupLog, "tx", tx1.hash);

    committedRoot = poseidon.F.toString(
      poseidon([SECRET_POLICY_KEY, MAX_LIMIT, BigInt(ownerAddr).toString()])
    );
    logLine(setupLog, "Committed policy hash (limit is HIDDEN): " + committedRoot.slice(0, 24) + "…", "dim");

    const spendAuth = new ethers.Contract(deployment.zkSpendAuth, REGISTRY_ABI, signer);
    const tx2 = await spendAuth.registerPolicy(AGENT_ID, committedRoot);
    await tx2.wait();
    logTx(setupLog, "tx", tx2.hash);
    logLine(setupLog, "Policy committed on-chain. Real limit (1000) never left this browser.", "pass");

    $("passBtn").disabled = false;
    $("failBtn").disabled = false;
    $("runAgentBtn").disabled = false;

    setStage("stage2", "done", "committed");
    setStage("stage3", "active", "ready");
    setStage("stage4", "active", "ready");
    
    // Initialize agent
    agent = new BlindCapAgent(poseidon, committedRoot, SECRET_POLICY_KEY, MAX_LIMIT, signer, deployment);
  } catch (err) {
    logLine(setupLog, "ERROR: " + (err.reason || err.message), "block");
  }
}

async function attemptSpend(amount, targetLogId) {
  const el = $(targetLogId);
  clearLog(el);
  try {
    const ownerAddr = await signer.getAddress();
    const spendAuth = new ethers.Contract(deployment.zkSpendAuth, REGISTRY_ABI, signer);

    logLine(el, `Requesting on-chain validation for spend of ${amount}…`, "dim");
    const reqTx = await spendAuth.validationRequest(AGENT_ID, amount);
    const receipt = await reqTx.wait();
    const event = receipt.logs
      .map((l) => { try { return spendAuth.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "ValidationRequested");
    const requestHash = event.args.requestHash;
    logTx(el, "tx", reqTx.hash);

    logLine(el, "Generating Groth16 proof in this browser…", "dim");
    const t0 = performance.now();
    const input = {
      secretPolicyKey: SECRET_POLICY_KEY,
      maxLimit: MAX_LIMIT,
      committedRoot,
      requestedAmount: amount.toString(),
      ownerAddr: BigInt(ownerAddr).toString(),
    };
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "circuit/spend_auth.wasm",
      "circuit/spend_auth_final.zkey"
    );
    logLine(el, `Proof generated in ${Math.round(performance.now() - t0)}ms`, "dim");

    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [pA, pB, pC] = JSON.parse(`[${calldata}]`);

    logLine(el, "Submitting proof on-chain for verification…", "dim");
    const respTx = await spendAuth.validationResponse(requestHash, pA, pB, pC);
    await respTx.wait();
    logTx(el, "tx", respTx.hash);
    logLine(el, "PASSED — spend authorized on-chain, limit never revealed.", "pass");
  } catch (err) {
    if (String(err.message || "").includes("Assert Failed") || String(err).includes("witness")) {
      logLine(el, "BLOCKED — no valid proof exists for this amount against the hidden limit.", "block");
      logLine(el, "This never even reaches the chain: the circuit has no satisfying witness.", "dim");
    } else {
      logLine(el, "ERROR: " + (err.reason || err.message), "block");
    }
  }
}

$("connectBtn").addEventListener("click", connect);
$("setupBtn").addEventListener("click", setupPolicy);
$("passBtn").addEventListener("click", () => attemptSpend(500, "spendLog"));
$("failBtn").addEventListener("click", () => attemptSpend(5000, "spendLog"));

/* ---- AI Agent functions ---------------------------------------- */

async function runAgent() {
  const agentLog = $("agentLog");
  clearLog(agentLog);
  $("runAgentBtn").disabled = true;
  $("stopAgentBtn").disabled = false;
  $("agentStats").style.display = "flex";
  
  setStage("stage4", "active", "running");
  
  logLine(agentLog, "🤖 Starting AI Agent decision cycle...", "dim");
  logLine(agentLog, "Agent will evaluate 5 opportunities and attempt spends using Blind Cap.", "dim");
  
  const logCallback = (logEntry) => {
    const status = logEntry.decision === "APPROVED" ? "pass" : 
                   logEntry.decision === "BLOCKED" ? "block" : "dim";
    
    logLine(agentLog, `🎯 ${logEntry.opportunity} ($${logEntry.cost})`, "dim");
    logLine(agentLog, `   Decision: ${logEntry.decision} — ${logEntry.reasoning}`, status);
    
    if (logEntry.proofGenerated !== undefined) {
      if (logEntry.proofGenerated) {
        logLine(agentLog, `   ✓ Proof generated in ${logEntry.proofTime}ms`, "pass");
      } else {
        logLine(agentLog, `   ✗ No proof exists — exceeds hidden limit`, "block");
      }
    }
    
    updateAgentStats();
  };
  
  try {
    await agent.runDecisionCycle(5, 1500, logCallback);
    logLine(agentLog, "🏁 Agent decision cycle complete.", "pass");
    
    const stats = agent.getDecisionStats();
    logLine(agentLog, `📊 Final stats: ${stats.approved} approved, ${stats.blocked} blocked, ${stats.skipped} skipped`, "dim");
    
    setStage("stage4", "done", "completed");
    
  } catch (err) {
    logLine(agentLog, "ERROR: " + (err.reason || err.message), "block");
    setStage("stage4", "active", "error");
  }
  
  $("runAgentBtn").disabled = false;
  $("stopAgentBtn").disabled = true;
}

function stopAgent() {
  if (agent) {
    agent.stop();
    logLine($("agentLog"), "🛑 Agent stopped by user.", "block");
    setStage("stage4", "active", "stopped");
    $("runAgentBtn").disabled = false;
    $("stopAgentBtn").disabled = true;
  }
}

function updateAgentStats() {
  if (!agent) return;
  
  const stats = agent.getDecisionStats();
  $("statTotal").textContent = stats.total;
  $("statApproved").textContent = stats.approved;
  $("statBlocked").textContent = stats.blocked;
  $("statSkipped").textContent = stats.skipped;
}

$("runAgentBtn").addEventListener("click", runAgent);
$("stopAgentBtn").addEventListener("click", stopAgent);

loadDeployment();
