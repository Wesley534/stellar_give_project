import apiClient from "../client";

export type InvoiceStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "FINANCING_REQUESTED"
  | "FUNDED"
  | "SETTLED"
  | "CLOSED"
  | "REJECTED";

export interface InvoiceRecord {
  id: string;
  customerId?: string | null;
  customerName: string;
  customerWalletAddress?: string | null;
  invoiceNumber: string;
  invoiceAmount: number;
  dueDate: string;
  status: InvoiceStatus;
  financingRequest?: {
    id: string;
    status: string;
    grossBorrowAmount: number;
    expectedSettlementAmount: number;
  } | null;
  settlement?: {
    id: string;
    invoiceAmount: number;
    createdAt: string;
  } | null;
  createdAt: string;
}

export interface InvoiceListEnvelope {
  success: boolean;
  message: string;
  data: InvoiceRecord[];
}

export interface InvoiceActionEnvelope {
  success: boolean;
  message: string;
  data: {
    invoice: InvoiceRecord;
    stellar: Record<string, unknown>;
  };
}

export interface InvoiceCreateEnvelope {
  success: boolean;
  message: string;
  data: {
    invoice: InvoiceRecord;
    stellar: Record<string, unknown>;
  };
}

export async function listInvoices(status?: InvoiceStatus) {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await apiClient.get<InvoiceListEnvelope>(`/invoices${params}`);
  return response.data;
}

export async function createInvoice(input: {
  customerId?: string;
  customerName?: string;
  customerWalletAddress?: string;
  invoiceNumber: string;
  invoiceAmount: number;
  dueDate: string;
}) {
  const response = await apiClient.post<InvoiceCreateEnvelope>(`/invoices`, input);
  return response.data;
}

export async function verifyInvoice(invoiceId: string) {
  const response = await apiClient.post<InvoiceActionEnvelope>(`/invoices/${invoiceId}/verify`);
  return response.data;
}

export async function rejectInvoice(invoiceId: string) {
  const response = await apiClient.post<InvoiceActionEnvelope>(`/invoices/${invoiceId}/reject`);
  return response.data;
}
