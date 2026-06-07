import apiClient from "../client";

export interface ContractMetadata {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  tokenAddress: string;
  readSourceAccount: string;
  adminSourceAccount: string | null;
  tokenTrustlineAsset: string | null;
  tokenIssuerAccount: string | null;
  autoFundingConfigured: boolean;
  configured: boolean;
}

export interface ContractMetadataEnvelope {
  success: boolean;
  message: string;
  data: ContractMetadata;
}

export interface ContractCallEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data: {
    function: string;
    sourceAccount: string;
    mode: "read" | "build";
    commandPreview: string[];
    output: T;
  };
}

export interface SubmittedTransactionEnvelope {
  success: boolean;
  message: string;
  data: {
    hash: string;
    output: unknown;
  };
}

export interface DepositFlowResponse {
  walletAddress: string;
  tokenAddress: string;
  trustlineAsset: string | null;
  amount: number;
  tokenBalance: number;
  balanceReadable: boolean;
  trustlineRequired: boolean;
  fundingRequired: boolean;
  autoFundingAvailable: boolean;
  trustline: ContractCallEnvelope<string>["data"] | null;
  approve: ContractCallEnvelope<string>["data"] | null;
  deposit: ContractCallEnvelope<string>["data"] | null;
}

export interface DepositFlowEnvelope {
  success: boolean;
  message: string;
  data: DepositFlowResponse;
}

export async function getContractMetadata() {
  return apiClient.get<ContractMetadataEnvelope>("/contract/metadata");
}

export async function getContractPool() {
  return apiClient.get<ContractCallEnvelope>("/contract/pool");
}

export async function buildDeposit(amount: number) {
  return apiClient.post<ContractCallEnvelope<string>>("/contract/actions/deposit", {
    amount,
  });
}

export async function prepareDepositFlow(amount: number) {
  return apiClient.post<DepositFlowEnvelope>("/contract/actions/deposit/prepare", {
    amount,
  });
}

export async function buildTokenApprove(amount: number) {
  return apiClient.post<ContractCallEnvelope<string>>("/contract/actions/token/approve", {
    amount,
  });
}

export async function buildInvestorTrustline() {
  return apiClient.post<ContractCallEnvelope<string>>("/contract/actions/token/trustline");
}

export async function fundInvestorTokens(amount: number) {
  return apiClient.post<ContractCallEnvelope>("/contract/actions/token/fund", {
    amount,
  });
}

export async function submitSignedTransaction(signedXdr: string) {
  return apiClient.post<SubmittedTransactionEnvelope>("/contract/actions/submit", {
    signedXdr,
  });
}

export async function buildWithdraw(shareAmount: number) {
  return apiClient.post<ContractCallEnvelope<string>>("/contract/actions/withdraw", {
    shareAmount,
  });
}

export async function buildApproveFinancing(requestId: string) {
  return apiClient.post<ContractCallEnvelope>(`/contract/actions/financing/${requestId}/approve`);
}

export async function buildRejectFinancing(requestId: string) {
  return apiClient.post<ContractCallEnvelope>(`/contract/actions/financing/${requestId}/reject`);
}

export async function buildWithdrawPlatformFees(amount: number) {
  return apiClient.post<ContractCallEnvelope>("/contract/actions/platform-fees/withdraw", {
    amount,
  });
}
