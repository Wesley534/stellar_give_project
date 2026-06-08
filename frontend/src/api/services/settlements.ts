import apiClient from "../client";
import type { ContractCallEnvelope } from "./contract";

export interface SettlementResponse {
  success: boolean;
  message: string;
  data: {
    settlement: Record<string, unknown>;
    supplierPayout?: Record<string, unknown> | null;
    pool: Record<string, unknown>;
    stellar: Record<string, unknown>;
  };
}

export async function prepareInvoiceSettlement(requestId: string) {
  const response = await apiClient.post<ContractCallEnvelope<string>>(
    `/settlements/${requestId}/pay-invoice/prepare`,
  );
  return response.data;
}

export async function payInvoiceSettlement(requestId: string, transactionHash: string) {
  const response = await apiClient.post<SettlementResponse>(`/settlements/${requestId}/pay-invoice`, {
    transactionHash,
  });
  return response.data;
}
