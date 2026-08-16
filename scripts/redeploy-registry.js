const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const EXISTING_VERIFIER = "0x4dE6AF7329E88F08C0560DAf1290a0DF152901E3";
const EXISTING_IDENTITY = "0x2274D05C24527D0e4b689b215ddEAfE51B319008";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MON");

  const ZKSpendAuth = await hre.ethers.getContractFactory("ZKSpendAuth");
  const spendAuth = await ZKSpendAuth.deploy(EXISTING_VERIFIER, EXISTING_IDENTITY);
  await spendAuth.waitForDeployment();
  console.log("New ZKSpendAuth (with revocation):", await spendAuth.getAddress());

  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    groth16Verifier: EXISTING_VERIFIER,
    identityRegistry: EXISTING_IDENTITY,
    zkSpendAuth: await spendAuth.getAddress(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(__dirname, "..", "deployment.json"), JSON.stringify(deployment, null, 2));
  fs.writeFileSync(
    path.join(__dirname, "..", "public", "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("\nSaved deployment.json (root + public/)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
