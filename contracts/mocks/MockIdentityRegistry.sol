// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal stand-in for an ERC-8004-style agent identity registry.
contract MockIdentityRegistry {
    mapping(uint256 => address) public owners;

    function register(uint256 agentId, address owner) external {
        owners[agentId] = owner;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        return owners[agentId];
    }
}
