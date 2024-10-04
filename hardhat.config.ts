import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-viem";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";
dotenv.config();

const providerApiKey = process.env.RPC_API_KEY || "";
const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
      sepolia: {
        url: providerApiKey || "",
        chainId: 11155111,
        accounts:
          process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      },
    },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY__SEPOLIA || "",
    },
  },
  sourcify: {
    enabled: true
  }
};

export default config;