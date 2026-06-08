import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FinancingRequestCard } from "../components/FinancingRequestCard";
import { InvoiceCard } from "../components/InvoiceCard";
import { StatusBadge } from "../components/StatusBadge";
import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";
import { useWallet } from "../context/WalletContext";
import {
  approveFinancingRequest,
  finalizeDisbursement,
  listFinancingRequests,
  prepareDisbursement,
  rejectFinancingRequest,
  type BackendFinancingStatus,
  type FinancingListEnvelope,
  type FinancingRecord,
} from "../api/services/financing";
import { getContractMetadata } from "../api/services/contract";
import { listInvoices, rejectInvoice, verifyInvoice, type InvoiceListEnvelope } from "../api/services/invoices";
import { payInvoiceSettlement, prepareInvoiceSettlement } from "../api/services/settlements";
import { signAndSubmitBuiltTransaction } from "../utils/stellarSigning";

type FilterStatus =
  | "ALL"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "SETTLED"
  | "REJECTED"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "FINANCING_REQUESTED"
  | "FUNDED";

type UiFinancingStatus =
  | "PENDING_ADMIN_REVIEW"
  | "APPROVED"
  | "BORROWED"
  | "REPAID"
  | "REJECTED"
  | "CLOSED";

type UiFinancingRequest = {
  id: string;
  borrowerName: string;
  walletAddress: string;
  invoiceNumber: string;
  invoiceAmount: number;
  borrowAmount: number;
  repaymentAmount: number;
  dueDate: string;
  status: UiFinancingStatus;
  description: string;
  createdAt: string;
};

const CUSTOMER_STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending Verification", value: "PENDING_VERIFICATION" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Financing Requested", value: "FINANCING_REQUESTED" },
  { label: "Funded", value: "FUNDED" },
  { label: "Settled", value: "SETTLED" },
  { label: "Rejected", value: "REJECTED" },
];

const FINANCING_STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending Review", value: "PENDING_APPROVAL" },
  { label: "Approved", value: "APPROVED" },
  { label: "Active", value: "ACTIVE" },
  { label: "Settled", value: "SETTLED" },
  { label: "Rejected", value: "REJECTED" },
];

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

function mapStatus(status: BackendFinancingStatus): UiFinancingStatus {
  switch (status) {
    case "PENDING_APPROVAL":
      return "PENDING_ADMIN_REVIEW";
    case "APPROVED":
      return "APPROVED";
    case "ACTIVE":
      return "BORROWED";
    case "SETTLED":
      return "REPAID";
    case "REJECTED":
      return "REJECTED";
    default:
      return "CLOSED";
  }
}

function mapRequest(record: FinancingRecord): UiFinancingRequest {
  return {
    id: record.id,
    borrowerName: record.supplier?.name ?? "Unknown borrower",
    walletAddress: record.supplier?.wallets?.[0]?.walletAddress ?? "No borrower wallet",
    invoiceNumber: record.invoice.invoiceNumber,
    invoiceAmount: record.invoice.invoiceAmount,
    borrowAmount: record.grossBorrowAmount,
    repaymentAmount: record.expectedSettlementAmount,
    dueDate: formatDate(record.invoice.dueDate),
    status: mapStatus(record.status),
    description: `Advance ${record.advanceRateBps / 100}% · Interest ${record.interestRateBps / 100}% · Fee ${record.processingFeeBps / 100}%`,
    createdAt: formatDate(record.createdAt),
  };
}

export function FinancingRequestsPage() {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [toastMessage, setToastMessage] = useState("");

  const queryClient = useQueryClient();
  const { walletAddress: connectedWalletAddress } = useWallet();
  const { data } = useGetCurrentUser();
  const user = data?.data?.data;
  const role = user?.role ?? "BORROWER";
  const isCustomer = role === "CUSTOMER";
  const isAdmin = role === "ADMIN";

  const metadataQuery = useQuery({
    queryKey: ["contract-metadata"],
    queryFn: getContractMetadata,
    enabled: isAdmin || isCustomer,
  });

  const invoiceQuery = useQuery<InvoiceListEnvelope, Error>({
    queryKey: ["customer-invoices", filter],
    queryFn: () =>
      listInvoices(filter === "ALL" ? undefined : (filter as "PENDING_VERIFICATION" | "VERIFIED" | "FINANCING_REQUESTED" | "FUNDED" | "SETTLED" | "REJECTED")),
    enabled: isCustomer,
  });

  const financingQuery = useQuery<FinancingListEnvelope, Error>({
    queryKey: ["all-financing-requests", filter, role],
    queryFn: () =>
      listFinancingRequests(
        filter === "ALL" || isCustomer
          ? undefined
          : (filter as BackendFinancingStatus),
      ),
    enabled: !isCustomer,
  });

  const contractMetadata = metadataQuery.data?.data?.data;
  const adminWalletAddress = contractMetadata?.adminSourceAccount ?? null;
  const isAdminWalletConnected = Boolean(
    connectedWalletAddress &&
      adminWalletAddress &&
      connectedWalletAddress === adminWalletAddress,
  );

  const customerInvoices = invoiceQuery.data?.data ?? [];
  const financingRecords = financingQuery.data?.data ?? [];
  const requests = useMemo(() => financingRecords.map(mapRequest), [financingRecords]);

  const refreshFinancing = async () => {
    await queryClient.invalidateQueries({ queryKey: ["all-financing-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["financing-requests"] });
  };

  const verifyMutation = useMutation({
    mutationFn: async (invoiceId: string) => verifyInvoice(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
      showToast("Invoice verified successfully");
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "Invoice verification failed",
      );
    },
  });

  const rejectInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => rejectInvoice(invoiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
      showToast("Invoice rejected successfully");
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "Invoice rejection failed",
      );
    },
  });

  const payMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!connectedWalletAddress) {
        throw new Error("Connect your wallet before paying the invoice.");
      }

      if (!contractMetadata?.networkPassphrase) {
        throw new Error("Contract network metadata is unavailable.");
      }

      const prepared = await prepareInvoiceSettlement(requestId);
      const submission = await signAndSubmitBuiltTransaction(
        prepared.data,
        contractMetadata.networkPassphrase,
        connectedWalletAddress,
      );

      return payInvoiceSettlement(requestId, submission.data.data.hash);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["all-financing-requests"] });
      showToast("Invoice payment recorded successfully");
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : "Invoice payment failed";
      showToast(message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) =>
      approveFinancingRequest(id, "Approved from all requests page."),
    onSuccess: async () => {
      await refreshFinancing();
      showToast("Financing request approved");
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : "Approval failed";
      showToast(message);
    },
  });

  const rejectFinancingMutation = useMutation({
    mutationFn: async (id: string) =>
      rejectFinancingRequest(id, "Rejected from all requests page."),
    onSuccess: async () => {
      await refreshFinancing();
      showToast("Financing request rejected");
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : "Rejection failed";
      showToast(message);
    },
  });

  const disburseMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!connectedWalletAddress) {
        throw new Error("Connect the admin wallet before disbursing funds.");
      }

      if (!contractMetadata?.networkPassphrase) {
        throw new Error("Contract network metadata is unavailable.");
      }

      const prepared = await prepareDisbursement(id);
      const submission = await signAndSubmitBuiltTransaction(
        prepared.data,
        contractMetadata.networkPassphrase,
        connectedWalletAddress,
      );

      return finalizeDisbursement(id, submission.data.data.hash);
    },
    onSuccess: async () => {
      await refreshFinancing();
      showToast("Funds disbursed successfully");
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : "Disbursement failed";
      showToast(message);
    },
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleVerifyInvoice = async (invoiceId: string) => {
    await verifyMutation.mutateAsync(invoiceId);
  };

  const handleRejectInvoice = async (invoiceId: string) => {
    await rejectInvoiceMutation.mutateAsync(invoiceId);
  };

  const handlePayInvoice = async (requestId: string) => {
    await payMutation.mutateAsync(requestId);
  };

  const requireAdminWallet = () => {
    if (!isAdmin) return true;
    if (!isAdminWalletConnected) {
      showToast("Connect the configured admin wallet before taking admin actions.");
      return false;
    }
    return true;
  };

  const handleApprove = (id: string) => {
    if (!requireAdminWallet()) return;
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    if (!requireAdminWallet()) return;
    rejectFinancingMutation.mutate(id);
  };

  const handleDisburse = (id: string) => {
    if (!requireAdminWallet()) return;
    disburseMutation.mutate(id);
  };

  const statusFilters = isCustomer ? CUSTOMER_STATUS_FILTERS : FINANCING_STATUS_FILTERS;

  return (
    <div className="animate-in">
      <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
        {(isCustomer
          ? [
              {
                label: "Total",
                value: customerInvoices.length,
                color: "var(--text-primary)",
              },
              {
                label: "Pending Verification",
                value: customerInvoices.filter((invoice) => invoice.status === "PENDING_VERIFICATION").length,
                color: "var(--accent-amber)",
              },
              {
                label: "Verified",
                value: customerInvoices.filter((invoice) => invoice.status === "VERIFIED").length,
                color: "var(--accent-cyan)",
              },
              {
                label: "Funded",
                value: customerInvoices.filter((invoice) => invoice.status === "FUNDED").length,
                color: "var(--accent-purple)",
              },
              {
                label: "Settled",
                value: customerInvoices.filter((invoice) => invoice.status === "SETTLED").length,
                color: "var(--accent-green)",
              },
            ]
          : [
              {
                label: "Total",
                value: requests.length,
                color: "var(--text-primary)",
              },
              {
                label: "Pending",
                value: requests.filter((r) => r.status === "PENDING_ADMIN_REVIEW").length,
                color: "var(--accent-amber)",
              },
              {
                label: "Approved",
                value: requests.filter((r) => r.status === "APPROVED").length,
                color: "var(--accent-cyan)",
              },
              {
                label: "Active",
                value: requests.filter((r) => r.status === "BORROWED").length,
                color: "var(--accent-purple)",
              },
              {
                label: "Repaid",
                value: requests.filter((r) => r.status === "REPAID").length,
                color: "var(--accent-green)",
              },
            ]).map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-label">{label}</div>
            <div className="stat-card-value" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: "1rem 1.25rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "var(--radius-full)",
                  border: "none",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  background:
                    filter === f.value
                      ? "var(--accent-teal)"
                      : "var(--bg-elevated)",
                  color:
                    filter === f.value ? "#05101e" : "var(--text-secondary)",
                  transition: "all var(--transition)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.4rem" }}>
            {(["cards", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background:
                    view === v ? "var(--bg-hover)" : "var(--bg-elevated)",
                  color:
                    view === v ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all var(--transition)",
                }}
              >
                {v === "cards" ? "⊞ Cards" : "≡ Table"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        {isCustomer ? (
          invoiceQuery.isLoading ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <p>Loading invoices assigned to your account…</p>
            </div>
          ) : customerInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>No invoices assigned to your account match the selected filter.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {customerInvoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onVerify={handleVerifyInvoice}
                  onReject={handleRejectInvoice}
                  onPay={handlePayInvoice}
                />
              ))}
            </div>
          )
        ) : financingQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Loading financing requests…</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No requests match the selected filter.</p>
          </div>
        ) : view === "cards" ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {requests.map((r) => (
              <FinancingRequestCard
                key={r.id}
                request={r}
                role={role}
                onApprove={handleApprove}
                onReject={handleReject}
                onBorrow={handleDisburse}
              />
            ))}
          </div>
        ) : (
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Borrower</th>
                    <th>Invoice</th>
                    <th>Invoice Amt</th>
                    <th>Borrow</th>
                    <th>Repayment</th>
                    <th>Due</th>
                    <th>Status</th>
                    {isAdmin && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="td-mono">{r.id}</span>
                      </td>
                      <td>
                        <strong>{r.borrowerName}</strong>
                      </td>
                      <td>{r.invoiceNumber}</td>
                      <td>{r.invoiceAmount.toLocaleString()} XLM</td>
                      <td>
                        <strong style={{ color: "var(--accent-teal)" }}>
                          {r.borrowAmount.toLocaleString()} XLM
                        </strong>
                      </td>
                      <td>{r.repaymentAmount.toLocaleString()} XLM</td>
                      <td>{r.dueDate}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {r.status === "PENDING_ADMIN_REVIEW" && (
                              <>
                                <button className="btn btn-success btn-sm" onClick={() => handleApprove(r.id)}>
                                  Approve
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleReject(r.id)}>
                                  Reject
                                </button>
                              </>
                            )}
                            {r.status === "APPROVED" && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleDisburse(r.id)}>
                                Disburse
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {toastMessage && <div className="toast success">{toastMessage}</div>}
    </div>
  );
}
