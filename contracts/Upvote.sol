// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Upvote
/// @notice A minimal, honest interest counter. One upvote per address,
/// stored on-chain - no backend, no database, nothing to fake.
contract Upvote {
    uint256 public totalUpvotes;
    mapping(address => bool) public hasUpvoted;

    event Upvoted(address indexed voter, uint256 totalUpvotes);

    error AlreadyUpvoted();

    function upvote() external {
        if (hasUpvoted[msg.sender]) revert AlreadyUpvoted();
        hasUpvoted[msg.sender] = true;
        totalUpvotes++;
        emit Upvoted(msg.sender, totalUpvotes);
    }
}
