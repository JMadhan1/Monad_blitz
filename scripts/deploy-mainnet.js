const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying to MAINNET with:", deployer.address);
  const balBefore = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balBefore), "MON");

  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  console.log("Groth16Verifier:", await verifier.getAddress());

  const MockIdentity = await hre.ethers.getContractFactory("MockIdentityRegistry");
  const identity = await MockIdentity.deploy();
  await identity.waitForDeployment();
  console.log("MockIdentityRegistry:", await identity.getAddress());

  const ZKSpendAuth = await hre.ethers.getContractFactory("ZKSpendAuth");
  const spendAuth = await ZKSpendAuth.deploy(await verifier.getAddress(), await identity.getAddress());
  await spendAuth.waitForDeployment();
  console.log("ZKSpendAuth:", await spendAuth.getAddress());

  const balAfter = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance after:", hre.ethers.formatEther(balAfter), "MON");
  console.log("Total spent:", hre.ethers.formatEther(balBefore - balAfter), "MON");

  const deployment = {
    network: "monadMainnet",
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    groth16Verifier: await verifier.getAddress(),
    identityRegistry: await identity.getAddress(),
    zkSpendAuth: await spendAuth.getAddress(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(__dirname, "..", "deployment.mainnet.json"), JSON.stringify(deployment, null, 2));
  console.log("\nSaved deployment.mainnet.json (root only - NOT public/, does not affect the live testnet demo)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
