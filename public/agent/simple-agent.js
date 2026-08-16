// Simple AI Agent that uses Blind Cap for autonomous spending decisions
class BlindCapAgent {
  constructor(poseidon, committedRoot, secretPolicyKey, maxLimit, signer, deployment) {
    this.poseidon = poseidon;
    this.committedRoot = committedRoot;
    this.secretPolicyKey = secretPolicyKey;
    this.maxLimit = maxLimit;
    this.signer = signer;
    this.deployment = deployment;
    this.decisionLog = [];
    this.isRunning = false;
  }

  // Simulate market opportunities the agent encounters
  generateMarketOpportunity() {
    const opportunities = [
      { name: "Premium API access", cost: 350, value: 0.8 },
      { name: "Data storage upgrade", cost: 200, value: 0.7 },
      { name: "Compute resources", cost: 450, value: 0.75 },
      { name: "Network bandwidth", cost: 150, value: 0.6 },
      { name: "Premium support", cost: 600, value: 0.5 },
      { name: "Security audit", cost: 800, value: 0.9 },
      { name: "Marketing campaign", cost: 300, value: 0.65 },
      { name: "R&D tools", cost: 250, value: 0.7 },
      { name: "Team training", cost: 400, value: 0.8 },
      { name: "Server expansion", cost: 550, value: 0.7 }
    ];
    
    return opportunities[Math.floor(Math.random() * opportunities.length)];
  }

  // Agent's decision logic - decides whether to attempt spending
  evaluateOpportunity(opportunity) {
    const withinLimit = opportunity.cost <= parseInt(this.maxLimit);
    const highValue = opportunity.value >= 0.7;
    
    return {
      shouldAttempt: withinLimit && highValue,
      confidence: opportunity.value,
      reasoning: withinLimit ? 
        (highValue ? "High value opportunity within limit" : "Within limit but lower value") :
        "Exceeds hidden limit"
    };
  }

  // Attempt to spend using Blind Cap - this will fail if over limit
  async attemptSpend(opportunity, logCallback) {
    const decision = this.evaluateOpportunity(opportunity);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      opportunity: opportunity.name,
      cost: opportunity.cost,
      decision: decision.shouldAttempt ? "ATTEMPTING" : "SKIPPED",
      confidence: decision.confidence,
      reasoning: decision.reasoning
    };

    if (logCallback) logCallback(logEntry);

    if (!decision.shouldAttempt) {
      this.decisionLog.push(logEntry);
      return logEntry;
    }

    try {
      // Generate ZK proof for the spend
      const ownerAddr = await this.signer.getAddress();
      const input = {
        secretPolicyKey: this.secretPolicyKey,
        maxLimit: this.maxLimit,
        committedRoot: this.committedRoot,
        requestedAmount: opportunity.cost.toString(),
        ownerAddr: BigInt(ownerAddr).toString(),
      };

      logEntry.proofStart = Date.now();
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "circuit/spend_auth.wasm",
        "circuit/spend_auth_final.zkey"
      );
      logEntry.proofTime = Date.now() - logEntry.proofStart;

      const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
      const [pA, pB, pC] = JSON.parse(`[${calldata}]`);

      logEntry.proofGenerated = true;
      logEntry.result = "SUCCESS - Proof generated in " + logEntry.proofTime + "ms";
      logEntry.decision = "APPROVED";
      
    } catch (error) {
      logEntry.proofGenerated = false;
      logEntry.result = "BLOCKED - No valid proof exists (exceeds hidden limit)";
      logEntry.decision = "BLOCKED";
      logEntry.error = error.message;
    }

    if (logCallback) logCallback(logEntry);
    this.decisionLog.push(logEntry);
    return logEntry;
  }

  // Run autonomous decision cycle
  async runDecisionCycle(cycles = 5, delay = 2000, logCallback) {
    this.isRunning = true;
    const results = [];

    for (let i = 0; i < cycles; i++) {
      if (!this.isRunning) break;

      const opportunity = this.generateMarketOpportunity();
      
      const result = await this.attemptSpend(opportunity, logCallback);
      results.push(result);
      
      if (i < cycles - 1 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.isRunning = false;
    return results;
  }

  stop() {
    this.isRunning = false;
  }

  getDecisionStats() {
    const decisions = this.decisionLog;
    const approved = decisions.filter(d => d.decision === "APPROVED").length;
    const blocked = decisions.filter(d => d.decision === "BLOCKED").length;
    const skipped = decisions.filter(d => d.decision === "SKIPPED").length;
    
    return {
      total: decisions.length,
      approved,
      blocked,
      skipped,
      approvalRate: decisions.length > 0 ? (approved / decisions.length * 100).toFixed(1) : 0,
      decisions: decisions
    };
  }
}

export default BlindCapAgent;