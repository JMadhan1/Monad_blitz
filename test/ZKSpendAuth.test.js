const { expect } = require("chai");
const path = require("path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

const BUILD = path.join(__dirname, "..", "circuits", "build");
const WASM = path.join(BUILD, "spend_auth_js", "spend_auth.wasm");
const ZKEY = path.join(BUILD, "spend_auth_final.zkey");

async function buildProofCalldata(input) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC] = JSON.parse(`[${calldata}]`);
  return { pA, pB, pC };
}

describe("ZKSpendAuth", function () {
  this.timeout(120000);

  let verifier, identity, spendAuth, owner, agentId, ownerAddrUint, poseidon, committedRoot;
  const secretPolicyKey = "424242424242";
  const maxLimit = "1000";

  before(async function () {
    [owner] = await ethers.getSigners();
    agentId = 1n;
    ownerAddrUint = BigInt(owner.address);
    poseidon = await buildPoseidon();

    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    verifier = await Verifier.deploy();

    const MockIdentity = await ethers.getContractFactory("MockIdentityRegistry");
    identity = await MockIdentity.deploy();
    await identity.register(agentId, owner.address);

    const ZKSpendAuth = await ethers.getContractFactory("ZKSpendAuth");
    spendAuth = await ZKSpendAuth.deploy(await verifier.getAddress(), await identity.getAddress());

    committedRoot = poseidon.F.toString(poseidon([secretPolicyKey, maxLimit, ownerAddrUint.toString()]));
    await spendAuth.registerPolicy(agentId, committedRoot);
  });

  it("passes for a spend within the hidden limit", async function () {
    const tx = await spendAuth.validationRequest(agentId, 500);
    const receipt = await tx.wait();
    const requestHash = receipt.logs
      .map((l) => spendAuth.interface.parseLog(l))
      .find((e) => e && e.name === "ValidationRequested").args.requestHash;

    const { pA, pB, pC } = await buildProofCalldata({
      secretPolicyKey, maxLimit, committedRoot,
      requestedAmount: "500", ownerAddr: ownerAddrUint.toString(),
    });

    await expect(spendAuth.validationResponse(requestHash, pA, pB, pC))
      .to.emit(spendAuth, "ValidationResponded")
      .withArgs(requestHash, agentId, 2n);
  });

  it("cannot produce a proof for a spend over the hidden limit", async function () {
    let threw = false;
    try {
      await buildProofCalldata({
        secretPolicyKey, maxLimit, committedRoot,
        requestedAmount: "5000", ownerAddr: ownerAddrUint.toString(),
      });
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });
});
