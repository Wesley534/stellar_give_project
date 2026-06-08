import { StatusBadge } from "./StatusBadge";
import type { InvoiceRecord } from "../api/services/invoices";

interface Props {
  invoice: InvoiceRecord;
  onVerify: (invoiceId: string) => Promise<void>;
  onReject: (invoiceId: string) => Promise<void>;
  onPay: (requestId: string) => Promise<void>;
}

export function InvoiceCard({ invoice, onVerify, onReject, onPay }: Props) {
  return (
    <div className="request-card animate-in">
      <div className="request-card-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            {invoice.invoiceNumber}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            {invoice.customerName} · Due {new Date(invoice.dueDate).toLocaleDateString()}
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="request-card-amounts">
        <div className="amount-item">
          <span className="amount-label">Invoice Value</span>
          <span className="amount-value">{invoice.invoiceAmount.toLocaleString()} XLM</span>
        </div>
        <div className="amount-item">
          <span className="amount-label">Customer Wallet</span>
          <span className="amount-value" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {invoice.customerWalletAddress ?? "Connect wallet later if settlement needs it"}
          </span>
        </div>
        {invoice.financingRequest && (
          <div className="amount-item">
            <span className="amount-label">Financing Request</span>
            <span className="amount-value">{invoice.financingRequest.id}</span>
          </div>
        )}
      </div>

      <div className="request-card-actions">
        {invoice.status === "PENDING_VERIFICATION" && (
          <>
            <button className="btn btn-success btn-sm" onClick={() => onVerify(invoice.id)}>
              ✓ Verify Invoice
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onReject(invoice.id)}>
              ✗ Reject Invoice
            </button>
          </>
        )}

        {invoice.status === "FUNDED" && invoice.financingRequest?.id ? (
          <button
            className="btn btn-purple btn-sm"
            onClick={() => onPay(invoice.financingRequest!.id)}
          >
            💰 Pay Invoice
          </button>
        ) : null}
      </div>
      <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
          {invoice.id}
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          Created {new Date(invoice.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
