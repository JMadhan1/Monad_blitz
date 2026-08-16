const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Upvote with:", deployer.address);

  const Upvote = await hre.ethers.getContractFactory("Upvote");
  const upvote = await Upvote.deploy();
  await upvote.waitForDeployment();
  const addr = await upvote.getAddress();
  console.log("Upvote:", addr);

  fs.writeFileSync(
    path.join(__dirname, "..", "public", "upvote-deployment.json"),
    JSON.stringify({ address: addr, network: hre.network.name, chainId: (await hre.ethers.provider.getNetwork()).chainId.toString() }, null, 2)
  );
  console.log("Saved public/upvote-deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
