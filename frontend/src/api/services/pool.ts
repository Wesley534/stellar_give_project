import apiClient from "../client";

export interface PoolResponse {
  totalLiquidity: number;
  availableLiquidity: number;
  totalShares: number;
  activeFinancingCount: number;
  outstandingPrincipal: number;
  totalInterestEarned: number;
  totalPlatformFees: number;
  sharePrice: number;
  fiatSimulationRateKesPerXlm: number;
  stellar: {
    network: string;
    contractId: string;
    tokenAddress: string;
  };
  onChain?: unknown;
}

export interface PoolEnvelope {
  success: boolean;
  message: string;
  data: PoolResponse;
}

export interface InvestorPositionResponse {
  sharesOwned: number;
  currentValue: number;
  depositedAmount: number;
  earnedInterest: number;
  poolSharePercentage: number;
  onChain?: unknown;
}

export interface InvestorPositionEnvelope {
  success: boolean;
  message: string;
  data: InvestorPositionResponse;
}

export interface InvestorEarningsResponse {
  walletAddress: string;
  depositedAmount: number;
  currentValue: number;
  earnedInterest: number;
  estimatedWithdrawableAmount: number;
  sharesOwned: number;
  poolSharePercentage: number;
  yieldPercentage: number;
  onChain?: unknown;
}

export interface InvestorEarningsEnvelope {
  success: boolean;
  message: string;
  data: InvestorEarningsResponse;
}

export interface InvestorDepositRecord {
  id: string;
  walletAddress: string;
  sourceType: string;
  sourceAmount: number;
  tokenAmount: number;
  sharesReceived: number;
  transactionHash?: string | null;
  createdAt: string;
}

export interface InvestorDepositsResponse {
  walletAddress: string;
  totals: {
    totalSourceAmount: number;
    totalTokenAmount: number;
    totalSharesReceived: number;
    depositCount: number;
  };
  deposits: InvestorDepositRecord[];
}

export interface InvestorDepositsEnvelope {
  success: boolean;
  message: string;
  data: InvestorDepositsResponse;
}

export interface InvestorActivityRecord {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  sourceType: string | null;
  walletAddress: string;
  sourceAmount: number;
  tokenAmount: number;
  sharesAmount: number;
  transactionHash?: string | null;
  createdAt: string;
}

export interface InvestorActivityResponse {
  walletAddress: string;
  activity: InvestorActivityRecord[];
}

export interface InvestorActivityEnvelope {
  success: boolean;
  message: string;
  data: InvestorActivityResponse;
}

export async function getPoolInfo() {
  return apiClient.get<PoolEnvelope>("/pool/info");
}

export async function getInvestorPosition() {
  return apiClient.get<InvestorPositionEnvelope>("/pool/position");
}

export async function getInvestorEarnings() {
  return apiClient.get<InvestorEarningsEnvelope>("/pool/earnings/me");
}

export async function getInvestorDeposits() {
  return apiClient.get<InvestorDepositsEnvelope>("/pool/deposits/me");
}

export async function getInvestorActivity() {
  return apiClient.get<InvestorActivityEnvelope>("/pool/activity/me");
}

export async function recordContractTokenDeposit(input: {
  tokenAmount: number;
  transactionHash: string;
}) {
  return apiClient.post("/pool/deposit/contract-token", input);
}
