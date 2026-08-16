pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Proves an AI agent's spend request is within a policy it committed to
// on-chain, without revealing the policy's secret key or its spend limit.
//
// committedRoot = Poseidon(secretPolicyKey, maxLimit, ownerAddr) is
// registered once, on-chain, at agent setup. This circuit proves, for a
// given committedRoot and requestedAmount:
//   1. the prover knows (secretPolicyKey, maxLimit) hashing to committedRoot
//   2. requestedAmount <= maxLimit
template SpendAuth(limitBits) {
    signal input secretPolicyKey;   // private
    signal input maxLimit;          // private
    signal input committedRoot;     // public
    signal input requestedAmount;   // public
    signal input ownerAddr;         // public

    component hasher = Poseidon(3);
    hasher.inputs[0] <== secretPolicyKey;
    hasher.inputs[1] <== maxLimit;
    hasher.inputs[2] <== ownerAddr;
    hasher.out === committedRoot;

    component leq = LessEqThan(limitBits);
    leq.in[0] <== requestedAmount;
    leq.in[1] <== maxLimit;
    leq.out === 1;
}

component main {public [committedRoot, requestedAmount, ownerAddr]} = SpendAuth(64);
