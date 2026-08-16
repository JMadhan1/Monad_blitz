# Blind Cap

**An AI agent proves it can afford a payment — without ever revealing what it's allowed to spend.**

*(Product name: Blind Cap. On-chain contract name: `ZKSpendAuth` — verified under that name below.)*

Built at Monad Blitz Bangalore V5, 16 August 2026.

---

## The gap this fills

AI agents already pay for things autonomously on Monad — x402, agentic payment rails, MCP-driven commerce. What nobody checks is whether the agent was *authorized* to spend that amount before the payment settles. Any agent holding a signing key can move any sum.

Monad's ERC-8004 "Trustless Agents" standard has an Identity Registry and a Reputation Registry live on mainnet. The piece that would actually gate an agent's spend before it happens — a Validation Registry — doesn't exist anywhere yet. This is one.

And the obvious way to build it — put the spend limit on-chain as a plain number — leaks a business's entire budget to every competitor watching the chain. So this one hides the number instead.

## How it actually works

Say an agent's owner sets a limit of **1000**. That number is never written anywhere on-chain — only `Poseidon(secretKey, 1000, ownerAddress)` is.

When the agent wants to pay, it generates a Groth16 zero-knowledge proof of one statement: *"the amount I'm requesting is ≤ the limit I committed to."* The contract checks the proof (~250k gas) and only then lets the payment through.

Try to request more than the hidden limit, and the circuit has no valid witness for it — no proof can even be generated. The over-limit request never reaches the chain at all; it's mathematically impossible to fake.

```
   owner picks 1000 (secret)
          │
          ▼
   Poseidon(secretKey, 1000, owner) ──── committed on-chain (the "1000" is gone)
          │
   agent requests 500 ──► proof: "500 ≤ hidden limit" ──► contract verifies ──► ✓ paid
   agent requests 5000 ─► no witness exists — proof generation itself fails ──► ✗ never reaches chain
```

## Try it — under a minute, no setup

This repo ships with everything **pre-built and pre-deployed** to Monad Testnet. You don't need to compile a circuit, deploy a contract, or touch a `.env` file to see it work.

```bash
git clone https://github.com/JMadhan1/Monad_blitz.git
cd Monad_blitz
npm install
npx serve public
```

Open the printed local URL, connect a MetaMask wallet with a little [testnet MON](https://faucet.monad.xyz) (MetaMask will prompt to add Monad Testnet automatically), and:

1. **Register agent + commit policy** — commits `Poseidon(secretKey, 1000, yourAddress)` on-chain. The `1000` never leaves your browser.
2. **Spend 500 — within hidden limit** — a real proof generates in-browser and gets verified on-chain live. Passes.
3. **Spend 5000 — over hidden limit** — no proof can be generated. Blocked before it ever touches the chain.

Every button click is a real transaction against the live contracts below — nothing here is simulated.

## Live deployment (Monad Testnet, chain 10143)

| Contract | Address | Source |
|---|---|---|
| **ZKSpendAuth** (main registry) | `0x165825Bd33c87c8aE31d60211dE9EE93e8039adE` | [verified ↗](https://testnet.monadvision.com/contracts/full_match/10143/0x165825Bd33c87c8aE31d60211dE9EE93e8039adE/) |
| Groth16Verifier | `0x4dE6AF7329E88F08C0560DAf1290a0DF152901E3` | [verified ↗](https://testnet.monadvision.com/contracts/full_match/10143/0x4dE6AF7329E88F08C0560DAf1290a0DF152901E3/) |
| MockIdentityRegistry | `0x2274D05C24527D0e4b689b215ddEAfE51B319008` | [verified ↗](https://testnet.monadvision.com/contracts/full_match/10143/0x2274D05C24527D0e4b689b215ddEAfE51B319008/) |

Live demo: `<VERCEL_URL_HERE>`

## What's in the repo

- `circuits/spend_auth.circom` — the whole trust model in ~30 lines: a Poseidon commitment check plus a `LessEqThan` range comparator
- `contracts/Groth16Verifier.sol` — snarkjs-generated, verifies proofs on-chain via Monad's native BN254 pairing precompiles
- `contracts/ZKSpendAuth.sol` — the registry: `registerPolicy`, `validationRequest`, `validationResponse`
- `contracts/mocks/MockIdentityRegistry.sol` — a minimal stand-in for a real ERC-8004 Identity Registry
- `public/` — a static frontend (no framework, no build step) that generates the ZK proof **in the browser** and submits it live

## Deploying your own instance (optional)

Only needed if you want to redeploy fresh contracts under your own key, rather than pointing at the deployment above.

```bash
# 1. rebuild the circuit + trusted setup (already built and committed — skip unless you changed the circuit)
./circom.exe circuits/spend_auth.circom --r1cs --wasm --sym -o circuits/build -l node_modules

# 2. add a deployer key
echo "DEPLOYER_PRIVATE_KEY=0x..." > .env

# 3. deploy — writes deployment.json to the repo root AND public/, so the frontend
#    picks up your fresh addresses automatically
npx hardhat run scripts/deploy.js --network monadTestnet

# 4. verify on Sourcify (already configured in hardhat.config.js)
npx hardhat verify --network monadTestnet <GROTH16_VERIFIER_ADDRESS>
npx hardhat verify --network monadTestnet <IDENTITY_REGISTRY_ADDRESS>
npx hardhat verify --network monadTestnet <ZKSPENDAUTH_ADDRESS> <VERIFIER_ADDRESS> <IDENTITY_REGISTRY_ADDRESS>

# 5. ship the frontend
npm install -g vercel && vercel public --prod
```

Run `npx hardhat test` any time — two tests, one proving a valid spend, one proving an over-limit spend can't even produce a witness.

## Honest limitations

Built in a single-day hackathon window — these are the corners knowingly cut, and what closes them:

| Limitation | Why it's there | What fixes it |
|---|---|---|
| One flat limit per agent | No per-recipient or time-windowed budgets yet | A Merkle-root policy instead of a single hash |
| Single-contributor trusted setup | Time-boxed for today's window | Multi-party ceremony, or a setup-free proof system (Plonk/Halo2) before real money |
| No `revokePolicy()` | Can't invalidate a committed policy if the key leaks | Add revocation + policy versioning |
| Proof generation is in-browser (~1–2s) | Fine for a demo; too slow at high agent throughput | Server-side or cached proving |
| `MockIdentityRegistry` stands in for a real registry | No real ERC-8004 Identity Registry exists on testnet yet | Swap in the real one once it exists |

## Tech stack

Circom 2 + snarkjs (Groth16, BN254) · Solidity 0.8.24 + Hardhat · ethers.js v6 · vanilla JS/HTML/CSS frontend — zero framework, zero build step, so anyone can run it with nothing but Node installed.
