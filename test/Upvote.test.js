const { expect } = require("chai");

describe("Upvote", function () {
  it("counts a vote and blocks a second vote from the same address", async function () {
    const [voter] = await ethers.getSigners();
    const Upvote = await ethers.getContractFactory("Upvote");
    const upvote = await Upvote.deploy();

    await expect(upvote.upvote()).to.emit(upvote, "Upvoted").withArgs(voter.address, 1n);
    expect(await upvote.totalUpvotes()).to.equal(1n);

    await expect(upvote.upvote()).to.be.revertedWithCustomError(upvote, "AlreadyUpvoted");
  });
});
