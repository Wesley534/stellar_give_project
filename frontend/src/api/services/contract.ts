import apiClient from "../client";

export interface ContractMetadata {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  tokenAddress: string;
  readSourceAccount: string;
  adminSourceAccount: string | null;
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

export async function getContractMetadata() {
  return apiClient.get<ContractMetadataEnvelope>("/contract/metadata");
}

export async function getContractPool() {
  return apiClient.get<ContractCallEnvelope>("/contract/pool");
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
