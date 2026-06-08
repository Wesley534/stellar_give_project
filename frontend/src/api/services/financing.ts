import apiClient from "../client";
import type { ContractCallEnvelope } from "./contract";

export type BackendFinancingStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "ACTIVE"
  | "SETTLED";

export interface FinancingRecord {
  id: string;
  invoiceId: string;
  supplierId: string;
  grossBorrowAmount: number;
  advanceRateBps: number;
  interestRateBps: number;
  interestAmount: number;
  processingFeeBps: number;
  processingFeeAmount: number;
  expectedSettlementAmount: number;
  status: BackendFinancingStatus;
  contractRequestId?: string | null;
  transactionHash?: string | null;
  approvedAt?: string | null;
  borrowedAt?: string | null;
  settledAt?: string | null;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    invoiceAmount: number;
    dueDate: string;
    customerName: string;
    customerWalletAddress?: string | null;
    status: string;
  };
  supplier?: {
    id: string;
    name: string;
    email: string;
    wallets?: {
      walletAddress: string;
    }[];
  };
}

export interface FinancingListEnvelope {
  success: boolean;
  message: string;
  data: FinancingRecord[];
}

export interface FinancingMutationEnvelope {
  success: boolean;
  message: string;
  data: {
    request: FinancingRecord;
    stellar?: Record<string, unknown>;
  };
}

export async function listFinancingRequests(status?: BackendFinancingStatus) {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await apiClient.get<FinancingListEnvelope>(`/financing${params}`);
  return response.data;
}

export interface FinancingCreateEnvelope {
  success: boolean;
  message: string;
  data: {
    request: FinancingRecord;
    stellar: Record<string, unknown>;
  };
}

export interface BorrowFinancingEnvelope {
  success: boolean;
  message: string;
  data: {
    request: FinancingRecord;
    pool: Record<string, unknown>;
    stellar: Record<string, unknown>;
  };
}

export async function requestFinancing(invoiceId: string) {
  const response = await apiClient.post<FinancingCreateEnvelope>(`/financing/request`, {
    invoiceId,
  });
  return response.data;
}

export async function borrowFinancing(requestId: string) {
  const response = await apiClient.post<BorrowFinancingEnvelope>(`/financing/${requestId}/borrow`);
  return response.data;
}

export async function approveFinancingRequest(id: string, note?: string) {
  const response = await apiClient.post<FinancingMutationEnvelope>(`/financing/${id}/approve`, { note });
  return response.data;
}

export async function rejectFinancingRequest(id: string, note?: string) {
  const response = await apiClient.post<FinancingMutationEnvelope>(`/financing/${id}/reject`, { note });
  return response.data;
}

export async function disburseFinancingRequest(id: string) {
  const response = await apiClient.post<BorrowFinancingEnvelope>(`/financing/${id}/disburse`);
  return response.data;
}

export async function prepareDisbursement(id: string) {
  const response = await apiClient.post<ContractCallEnvelope<string>>(
    `/financing/${id}/disburse/prepare`,
  );
  return response.data;
}

export async function finalizeDisbursement(id: string, transactionHash: string) {
  const response = await apiClient.post<BorrowFinancingEnvelope>(`/financing/${id}/disburse`, {
    transactionHash,
  });
  return response.data;
}
