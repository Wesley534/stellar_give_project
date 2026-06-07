import apiClient from "../client";

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

export async function listFinancingRequests() {
  return apiClient.get<FinancingListEnvelope>("/financing");
}

export async function approveFinancingRequest(id: string, note?: string) {
  return apiClient.post<FinancingMutationEnvelope>(`/financing/${id}/approve`, { note });
}

export async function rejectFinancingRequest(id: string, note?: string) {
  return apiClient.post<FinancingMutationEnvelope>(`/financing/${id}/reject`, { note });
}
