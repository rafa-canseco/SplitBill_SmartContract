import hre from "hardhat";
import { parseAbi } from "viem";

async function main() { 
  const usdt ="0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"
  const contract = await hre.viem.deployContract("ExpenseBalancer", [usdt], {
    abi: parseAbi([
      "constructor(address _stablecoinAddress)",
    ]),
  });

  console.log("ExpenseBalancer deployed to:", contract.address);

  try {
    await hre.run("verify:verify", {
      address: contract.address,
      constructorArguments: [usdt],
    });
    console.log("Contract Verified");
  } catch (error) {
    console.log("Error verifying Contract", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });