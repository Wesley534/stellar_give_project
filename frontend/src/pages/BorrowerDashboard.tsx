import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import toast from "react-hot-toast";
import { FinancingRequestCard } from "../components/FinancingRequestCard";
import { StatusBadge } from "../components/StatusBadge";
import { getAllUsers, type AuthUser } from "../api/services/auth";
import {
  createInvoice,
  listInvoices,
  type InvoiceListEnvelope,
} from "../api/services/invoices";
import {
  listFinancingRequests,
  requestFinancing,
  type BackendFinancingStatus,
  type FinancingListEnvelope,
  type FinancingRecord,
} from "../api/services/financing";

const EMPTY_FORM = {
  customerId: "",
  invoiceNumber: "",
  invoiceAmount: "",
  dueDate: "",
  description: "",
};

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
    borrowerName: record.supplier?.name ?? "My Business",
    walletAddress: record.invoice.customerWalletAddress ?? "No customer wallet",
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

export function BorrowerDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const customersQuery = useQuery<
    { success: boolean; message: string; data: AuthUser[] },
    Error
  >({
    queryKey: ["customer-users"],
    queryFn: async () => getAllUsers("CUSTOMER"),
  });
  const [submitting, setSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const invoicesQuery = useQuery<InvoiceListEnvelope, Error>({
    queryKey: ["borrower-invoices"],
    queryFn: () => listInvoices(),
  });

  const financingQuery = useQuery<FinancingListEnvelope, Error>({
    queryKey: ["borrower-financing-requests"],
    queryFn: () => listFinancingRequests(),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (input: {
      customerId: string;
      invoiceNumber: string;
      invoiceAmount: number;
      dueDate: string;
    }) => createInvoice(input),
    onSuccess: async () => {
      toast.success("Invoice created successfully");
      await queryClient.invalidateQueries({ queryKey: ["borrower-invoices"] });
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
    onError: (error) => {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message
        : error instanceof Error
          ? error.message
          : "Invoice creation failed";
      toast.error(message);
    },
    onSettled: () => setSubmitting(false),
  });

  const requestFinancingMutation = useMutation({
    mutationFn: (invoiceId: string) => requestFinancing(invoiceId),
    onSuccess: async () => {
      toast.success("Financing request created");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["borrower-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["borrower-financing-requests"] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Request financing failed");
    },
  });

  const invoices = invoicesQuery.data?.data ?? [];
  const customers = customersQuery.data?.data ?? [];
  const verifiedInvoices = invoices.filter((invoice) => invoice.status === "VERIFIED");
  const pendingInvoices = invoices.filter((invoice) => invoice.status === "PENDING_VERIFICATION");

  const financingRecords = financingQuery.data?.data ?? [];
  const requests = useMemo(
    () => financingRecords.map(mapRequest),
    [financingRecords],
  );

  const active = requests.filter((r) =>
    ["PENDING_ADMIN_REVIEW", "APPROVED", "BORROWED"].includes(r.status),
  );
  const history = requests.filter((r) =>
    ["REPAID", "REJECTED", "CLOSED"].includes(r.status),
  );

  const totalBorrowed = requests
    .filter((r) => r.status === "BORROWED")
    .reduce((s, r) => s + r.borrowAmount, 0);

  const handleSubmit = async () => {
    if (!form.customerId || !form.invoiceNumber || !form.invoiceAmount || !form.dueDate) {
      toast.error("Please select a customer and fill in all invoice fields.");
      return;
    }

    setSubmitting(true);
    await createInvoiceMutation.mutateAsync({
      customerId: form.customerId,
      invoiceNumber: form.invoiceNumber,
      invoiceAmount: Number(form.invoiceAmount),
      dueDate: new Date(form.dueDate).toISOString(),
    });
  };

  const handleRequestFinancing = async (invoiceId: string) => {
    await requestFinancingMutation.mutateAsync(invoiceId);
  };

  return (
    <div className="animate-in">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">📋</div>
          <div className="stat-card-label">Total Invoices</div>
          <div className="stat-card-value">{invoices.length}</div>
          <div className="stat-card-trend">{pendingInvoices.length} pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">Verified Invoices</div>
          <div className="stat-card-value">{verifiedInvoices.length}</div>
          <div className="stat-card-trend">ready for financing</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">⚡</div>
          <div className="stat-card-label">Active Requests</div>
          <div className="stat-card-value">{active.length}</div>
          <div className="stat-card-trend">funding progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-label">Currently Borrowed</div>
          <div className="stat-card-value">
            {totalBorrowed.toLocaleString()}
          </div>
          <div className="stat-card-trend">XLM outstanding</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>📝 New Invoice</h3>
            <p>Create a customer invoice and wait for verification.</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "✕ Cancel" : "+ New Invoice"}
          </button>
        </div>
        {showForm && (
          <div className="animate-in">
            <hr className="divider" />
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">Select Customer</label>
                <select
                  className="form-input"
                  value={form.customerId}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      customerId: e.target.value,
                    }))
                  }}
                >
                  <option value="">-- choose an existing customer --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </option>
                  ))}
                </select>
                {customersQuery.isLoading && (
                  <p className="form-help">Loading customers…</p>
                )}
                {!customersQuery.isLoading && customers.length === 0 && (
                  <p className="form-help">No customer users are available yet.</p>
                )}
              </div>
              <div className="form-field">
                <label className="form-label">Invoice Number</label>
                <input
                  className="form-input"
                  value={form.invoiceNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                  }
                  placeholder="INV-2026-001"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Invoice Amount (XLM)</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.invoiceAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceAmount: e.target.value }))
                  }
                  placeholder="10000"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Due Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="form-field" style={{ marginTop: "1rem" }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional details for your internal financing request"
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: "1.25rem" }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "⚡ Creating invoice…" : "Create Invoice"}
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>📄 Verified Invoices</h3>
            <p>Request financing for verified invoices that are ready to fund.</p>
          </div>
        </div>
        {invoicesQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Loading your invoices…</p>
          </div>
        ) : verifiedInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No verified invoices available for financing.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {verifiedInvoices.map((invoice) => (
              <div className="request-card animate-in" key={invoice.id}>
                <div className="request-card-header">
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {invoice.invoiceNumber}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        marginTop: "0.2rem",
                      }}
                    >
                      {invoice.customerName} · Due {new Date(invoice.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="badge badge-teal">Verified</span>
                </div>
                <div className="request-card-amounts">
                  <div className="amount-item">
                    <span className="amount-label">Invoice Amount</span>
                    <span className="amount-value">
                      {invoice.invoiceAmount.toLocaleString()} XLM
                    </span>
                  </div>
                  <div className="amount-item">
                    <span className="amount-label">Invoice ID</span>
                    <span className="amount-value" style={{ fontSize: "0.8rem" }}>
                      {invoice.id}
                    </span>
                  </div>
                </div>
                <div className="request-card-actions">
                        <button
                    className="btn btn-purple btn-sm"
                    disabled={requestFinancingMutation.status === "pending"}
                    onClick={() => handleRequestFinancing(invoice.id)}
                  >
                    Request Financing
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>📚 All My Invoices</h3>
            <p>Track each invoice through verification, financing, funding, and settlement.</p>
          </div>
        </div>
        {invoicesQuery.isLoading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Loading all invoice statuses…</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>You have not created any invoices yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {invoices.map((invoice) => (
              <div className="request-card animate-in" key={invoice.id}>
                <div className="request-card-header">
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {invoice.invoiceNumber}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        marginTop: "0.2rem",
                      }}
                    >
                      {invoice.customerName} · Due {new Date(invoice.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="request-card-amounts">
                  <div className="amount-item">
                    <span className="amount-label">Invoice Amount</span>
                    <span className="amount-value">
                      {invoice.invoiceAmount.toLocaleString()} XLM
                    </span>
                  </div>
                  <div className="amount-item">
                    <span className="amount-label">Financing Status</span>
                    <span className="amount-value" style={{ fontSize: "0.8rem" }}>
                      {invoice.financingRequest?.status ?? "Not requested"}
                    </span>
                  </div>
                  <div className="amount-item">
                    <span className="amount-label">Settlement</span>
                    <span className="amount-value" style={{ fontSize: "0.8rem" }}>
                      {invoice.settlement ? "Settled" : invoice.status === "FUNDED" ? "Awaiting payment" : "Not settled"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {active.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>⚡ Active Financing Requests</h3>
          </div>
          <div style={{ display: "grid", gap: "1rem" }}>
            {active.map((r) => (
              <FinancingRequestCard
                key={r.id}
                request={r}
                role="BORROWER"
              />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>📁 Financing History</h3>
          </div>
          <div style={{ display: "grid", gap: "1rem" }}>
            {history.map((r) => (
              <FinancingRequestCard key={r.id} request={r} role="BORROWER" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
