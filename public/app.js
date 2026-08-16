import { buildPoseidon } from "https://cdn.jsdelivr.net/npm/circomlibjs@0.1.7/+esm";

const MONAD_TESTNET = {
  chainId: "0x279f", // 10143
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz/"],
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
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
const EXPLORER = "https://testnet.monadexplorer.com/tx/";

let provider, signer, poseidon, deployment;
let committedRoot;

function log(el, msg) {
  el.textContent += msg + "\n";
}

async function loadDeployment() {
  const res = await fetch("deployment.json", { cache: "no-store" });
  deployment = await res.json();
  $("contractRow").innerHTML = `
    <span class="mono small">ZKSpendAuth: ${deployment.zkSpendAuth}</span>
  `;
  $("verifiedLink").innerHTML = `<a href="${EXPLORER}${deployment.deployTx || ""}" target="_blank">view deployment</a>`;
}

async function connect() {
  if (!window.ethereum) {
    alert("Install MetaMask to run this demo.");
    return;
  }
  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [MONAD_TESTNET],
    });
  } catch (e) {
    /* chain may already be added */
  }
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  const addr = await signer.getAddress();
  $("account").textContent = addr;
  $("setupBtn").disabled = false;

  poseidon = await buildPoseidon();
}

async function setupPolicy() {
  const setupLog = $("setupLog");
  setupLog.textContent = "";
  try {
    const ownerAddr = await signer.getAddress();

    log(setupLog, "Registering agent identity...");
    const identity = new ethers.Contract(deployment.identityRegistry, IDENTITY_ABI, signer);
    const tx1 = await identity.register(AGENT_ID, ownerAddr);
    await tx1.wait();
    log(setupLog, "  tx: " + EXPLORER + tx1.hash);

    committedRoot = poseidon.F.toString(
      poseidon([SECRET_POLICY_KEY, MAX_LIMIT, BigInt(ownerAddr).toString()])
    );
    log(setupLog, "Committed policy hash (limit is HIDDEN): " + committedRoot.slice(0, 24) + "...");

    const spendAuth = new ethers.Contract(deployment.zkSpendAuth, REGISTRY_ABI, signer);
    const tx2 = await spendAuth.registerPolicy(AGENT_ID, committedRoot);
    await tx2.wait();
    log(setupLog, "  tx: " + EXPLORER + tx2.hash);
    log(setupLog, "\nPolicy committed on-chain. Real limit (1000) never left this browser.");

    $("passBtn").disabled = false;
    $("failBtn").disabled = false;
  } catch (err) {
    log(setupLog, "ERROR: " + (err.reason || err.message));
  }
}

async function attemptSpend(amount, targetLogId) {
  const el = $(targetLogId);
  el.textContent = "";
  try {
    const ownerAddr = await signer.getAddress();
    const spendAuth = new ethers.Contract(deployment.zkSpendAuth, REGISTRY_ABI, signer);

    log(el, `Requesting on-chain validation for spend of ${amount}...`);
    const reqTx = await spendAuth.validationRequest(AGENT_ID, amount);
    const receipt = await reqTx.wait();
    const event = receipt.logs
      .map((l) => { try { return spendAuth.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "ValidationRequested");
    const requestHash = event.args.requestHash;
    log(el, "  tx: " + EXPLORER + reqTx.hash);

    log(el, "Generating Groth16 proof in this browser...");
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
    log(el, `  proof generated in ${Math.round(performance.now() - t0)}ms`);

    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const [pA, pB, pC] = JSON.parse(`[${calldata}]`);

    log(el, "Submitting proof on-chain for verification...");
    const respTx = await spendAuth.validationResponse(requestHash, pA, pB, pC);
    await respTx.wait();
    log(el, "  tx: " + EXPLORER + respTx.hash);
    log(el, "\n✅ PASSED — spend authorized on-chain, limit never revealed.");
  } catch (err) {
    if (String(err.message || "").includes("Assert Failed") || String(err).includes("witness")) {
      log(el, "\n❌ BLOCKED — no valid proof exists for this amount against the hidden limit.");
      log(el, "(This never even reaches the chain: the circuit has no satisfying witness.)");
    } else {
      log(el, "ERROR: " + (err.reason || err.message));
    }
  }
}

$("connectBtn").addEventListener("click", connect);
$("setupBtn").addEventListener("click", setupPolicy);
$("passBtn").addEventListener("click", () => attemptSpend(500, "spendLog"));
$("failBtn").addEventListener("click", () => attemptSpend(5000, "spendLog"));

loadDeployment();
