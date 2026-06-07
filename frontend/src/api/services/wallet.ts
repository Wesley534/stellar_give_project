import apiClient from "../client";

export type WalletNetwork = "TESTNET" | "MAINNET";

export interface WalletRecord {
  id: string;
  userId: string;
  walletAddress: string;
  network: WalletNetwork;
  isPrimary: boolean;
  connectionDate: string;
  createdAt: string;
}

export interface WalletsEnvelope {
  success: boolean;
  message: string;
  data: {
    wallets: WalletRecord[];
    primaryWallet: WalletRecord | null;
  };
}

export interface ConnectWalletEnvelope {
  success: boolean;
  message: string;
  data: {
    wallet: WalletRecord;
    stellar: {
      network: string;
      contractId: string;
      tokenAddress: string;
      transactionHash: string;
    };
  };
}

export async function connectWallet(input: {
  walletAddress: string;
  network: WalletNetwork;
}) {
  return apiClient.post<ConnectWalletEnvelope>("/wallets/connect", input);
}

export async function getMyWallets() {
  return apiClient.get<WalletsEnvelope>("/wallets/me");
}
