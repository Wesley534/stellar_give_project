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

export async function getPoolInfo() {
  return apiClient.get<PoolEnvelope>("/pool/info");
}
