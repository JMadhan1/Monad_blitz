const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MON");

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

  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    groth16Verifier: await verifier.getAddress(),
    identityRegistry: await identity.getAddress(),
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
