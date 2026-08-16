// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external view returns (bool);
}

interface IIdentityRegistryMinimal {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @title ZKSpendAuth
/// @notice An AI agent commits a hash of its spend policy once. Before any
/// payment, it proves in zero-knowledge that the requested amount is within
/// that committed policy - without ever revealing the actual limit or the
/// secret key on-chain.
contract ZKSpendAuth {
    enum Status { None, Pending, Passed, Failed }

    struct ValidationRequest {
        uint256 agentId;
        uint256 requestedAmount;
        uint256 requestedAt;
        Status status;
    }

    IGroth16Verifier public immutable verifier;
    IIdentityRegistryMinimal public immutable identityRegistry;

    mapping(uint256 => uint256) public policyCommitment; // agentId => Poseidon(secretKey, maxLimit, owner)
    mapping(bytes32 => ValidationRequest) public requests;

    event PolicyRegistered(uint256 indexed agentId, uint256 committedRoot);
    event ValidationRequested(bytes32 indexed requestHash, uint256 indexed agentId, uint256 requestedAmount);
    event ValidationResponded(bytes32 indexed requestHash, uint256 indexed agentId, Status status);

    error NotAgentOwner();
    error NoPolicyCommitted();
    error RequestNotFound();
    error RequestAlreadyResolved();
    error InvalidProof();

    constructor(address verifierAddress, address identityRegistryAddress) {
        verifier = IGroth16Verifier(verifierAddress);
        identityRegistry = IIdentityRegistryMinimal(identityRegistryAddress);
    }

    function registerPolicy(uint256 agentId, uint256 committedRoot) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        policyCommitment[agentId] = committedRoot;
        emit PolicyRegistered(agentId, committedRoot);
    }

    function validationRequest(uint256 agentId, uint256 requestedAmount) external returns (bytes32 requestHash) {
        if (policyCommitment[agentId] == 0) revert NoPolicyCommitted();

        requestHash = keccak256(abi.encodePacked(agentId, requestedAmount, block.timestamp, block.prevrandao));
        requests[requestHash] = ValidationRequest({
            agentId: agentId,
            requestedAmount: requestedAmount,
            requestedAt: block.timestamp,
            status: Status.Pending
        });

        emit ValidationRequested(requestHash, agentId, requestedAmount);
    }

    function validationResponse(
        bytes32 requestHash,
        uint[2] calldata pA,
        uint[2][2] calldata pB,
        uint[2] calldata pC
    ) external {
        ValidationRequest storage req = requests[requestHash];
        if (req.requestedAt == 0) revert RequestNotFound();
        if (req.status != Status.Pending) revert RequestAlreadyResolved();

        uint256 committedRoot = policyCommitment[req.agentId];
        uint256 ownerAddr = uint256(uint160(identityRegistry.ownerOf(req.agentId)));
        uint[3] memory publicSignals = [committedRoot, req.requestedAmount, ownerAddr];

        bool ok = verifier.verifyProof(pA, pB, pC, publicSignals);
        if (!ok) revert InvalidProof();

        req.status = Status.Passed;
        emit ValidationResponded(requestHash, req.agentId, req.status);
    }

    function getValidationStatus(bytes32 requestHash) external view returns (Status) {
        return requests[requestHash].status;
    }
}
