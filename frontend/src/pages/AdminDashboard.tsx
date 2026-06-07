import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  buildApproveFinancing,
  buildRejectFinancing,
  getContractMetadata,
} from "../api/services/contract";
import {
  approveFinancingRequest,
  listFinancingRequests,
  rejectFinancingRequest,
  type BackendFinancingStatus,
  type FinancingRecord,
} from "../api/services/financing";
import { getPoolInfo } from "../api/services/pool";
import { FinancingRequestCard } from "../components/FinancingRequestCard";
import { StatusBadge } from "../components/StatusBadge";

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
    borrowerName: record.supplier?.name ?? "Unknown borrower",
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

export function AdminDashboard({
  connectedWalletAddress,
}: {
  connectedWalletAddress: string | null;
}) {
  const queryClient = useQueryClient();
  const [actionLog, setActionLog] = useState<string | null>(null);

  const metadataQuery = useQuery({
    queryKey: ["contract-metadata"],
    queryFn: getContractMetadata,
  });

  const poolQuery = useQuery({
    queryKey: ["pool-info"],
    queryFn: getPoolInfo,
  });

  const financingQuery = useQuery({
    queryKey: ["financing-requests"],
    queryFn: listFinancingRequests,
  });

  const contractMetadata = metadataQuery.data?.data?.data;
  const pool = poolQuery.data?.data?.data;
  const records = financingQuery.data?.data?.data ?? [];
  const requests = useMemo(() => records.map(mapRequest), [records]);

  const pending = requests.filter((request) => request.status === "PENDING_ADMIN_REVIEW");
  const borrowed = requests.filter((request) => request.status === "BORROWED");
  const repaid = requests.filter((request) => request.status === "REPAID");
  const approved = requests.filter((request) => request.status === "APPROVED");

  const adminWalletAddress = contractMetadata?.adminSourceAccount ?? null;
  const isAdminWalletConnected = Boolean(
    connectedWalletAddress &&
      adminWalletAddress &&
      connectedWalletAddress === adminWalletAddress,
  );

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["financing-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["pool-info"] }),
      queryClient.invalidateQueries({ queryKey: ["contract-metadata"] }),
    ]);
  };

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const contractBuild = await buildApproveFinancing(requestId);
      const dbUpdate = await approveFinancingRequest(
        requestId,
        "Approved from the admin dashboard after wallet verification.",
      );

      return { contractBuild, dbUpdate };
    },
    onSuccess: async ({ contractBuild, dbUpdate }) => {
      setActionLog(
        `Prepared on-chain approval via ${contractBuild.data.data.function} and updated backend status for ${dbUpdate.data.data.request.id}.`,
      );
      toast.success("Financing request approved");
      await refreshData();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const contractBuild = await buildRejectFinancing(requestId);
      const dbUpdate = await rejectFinancingRequest(
        requestId,
        "Rejected from the admin dashboard after wallet verification.",
      );

      return { contractBuild, dbUpdate };
    },
    onSuccess: async ({ contractBuild, dbUpdate }) => {
      setActionLog(
        `Prepared on-chain rejection via ${contractBuild.data.data.function} and updated backend status for ${dbUpdate.data.data.request.id}.`,
      );
      toast.success("Financing request rejected");
      await refreshData();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Rejection failed");
    },
  });

  const handleApprove = (id: string) => {
    if (!isAdminWalletConnected) {
      toast.error("Connect the configured admin wallet before approving requests.");
      return;
    }

    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    if (!isAdminWalletConnected) {
      toast.error("Connect the configured admin wallet before rejecting requests.");
      return;
    }

    rejectMutation.mutate(id);
  };

  const utilizationPct =
    pool && pool.totalLiquidity > 0
      ? Math.round(
          ((pool.totalLiquidity - pool.availableLiquidity) / pool.totalLiquidity) * 100,
        )
      : 0;

  if (metadataQuery.isLoading || poolQuery.isLoading || financingQuery.isLoading) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-icon">⚡</div>
          <p>Loading admin controls, financing data, and contract metadata…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {!contractMetadata?.configured && (
        <div className="panel" style={{ borderColor: "rgba(251,191,36,0.3)" }}>
          <div className="panel-header">
            <div>
              <h3>⚠️ Contract configuration incomplete</h3>
              <p>
                The backend contract metadata is not fully configured yet. Reads and
                admin action preparation may fail until the real contract values are in
                `backend/.env`.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <div className="panel-header">
          <div>
            <h3>🛡️ Admin Wallet Verification</h3>
            <p>
              Admin actions are only enabled when the connected Freighter wallet matches
              the configured admin wallet.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Connected Wallet
            </div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-all" }}>
              {connectedWalletAddress ?? "No wallet connected"}
            </div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Required Admin Wallet
            </div>
            <div style={{ fontWeight: 700, color: "var(--accent-teal)", wordBreak: "break-all" }}>
              {adminWalletAddress ?? "Not configured"}
            </div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Access State
            </div>
            <div style={{ fontWeight: 800, color: isAdminWalletConnected ? "var(--accent-green)" : "var(--accent-amber)" }}>
              {isAdminWalletConnected ? "Verified" : "Wallet verification required"}
            </div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">Pending Review</div>
          <div className="stat-card-value">{pending.length}</div>
          <div className="stat-card-trend" style={{ color: "var(--accent-amber)" }}>
            awaiting action
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💧</div>
          <div className="stat-card-label">Pool Liquidity</div>
          <div className="stat-card-value">
            {pool?.totalLiquidity?.toLocaleString() ?? "0"}
          </div>
          <div className="stat-card-trend">{utilizationPct}% utilized</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📤</div>
          <div className="stat-card-label">Active Loans</div>
          <div className="stat-card-value">{borrowed.length}</div>
          <div className="stat-card-trend">
            {(pool?.outstandingPrincipal ?? 0).toLocaleString()} token principal out
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💸</div>
          <div className="stat-card-label">Platform Fees</div>
          <div className="stat-card-value">
            {(pool?.totalPlatformFees ?? 0).toLocaleString()}
          </div>
          <div className="stat-card-trend" style={{ color: "var(--accent-green)" }}>
            token fees accrued
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>🏦 Pool Health</h3>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          {[
            {
              label: "Total Liquidity",
              value: `${(pool?.totalLiquidity ?? 0).toLocaleString()} tokens`,
              color: "var(--accent-teal)",
            },
            {
              label: "Available",
              value: `${(pool?.availableLiquidity ?? 0).toLocaleString()} tokens`,
              color: "var(--accent-green)",
            },
            {
              label: "Settled Requests",
              value: `${repaid.length}`,
              color: "var(--accent-purple)",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.4rem",
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div className="progress-fill" style={{ width: `${utilizationPct}%` }} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginTop: "0.4rem",
          }}
        >
          <span>Pool Utilization</span>
          <span style={{ fontWeight: 700, color: "var(--accent-teal)" }}>
            {utilizationPct}%
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>⏳ Pending Review Queue</h3>
            <p>{pending.length} request{pending.length !== 1 ? "s" : ""} awaiting your decision</p>
          </div>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>All caught up. No pending requests at the moment.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {pending.map((request) => (
              <FinancingRequestCard
                key={request.id}
                request={request}
                role="ADMIN"
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>📋 All Financing Requests</h3>
            <p>
              {approved.length} approved · {borrowed.length} active · {repaid.length} settled
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Borrower</th>
                <th>Invoice</th>
                <th>Borrow</th>
                <th>Repayment</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <span className="td-mono">{request.id}</span>
                  </td>
                  <td>
                    <strong>{request.borrowerName}</strong>
                  </td>
                  <td>{request.invoiceNumber}</td>
                  <td>
                    <strong>{request.borrowAmount.toLocaleString()}</strong>
                  </td>
                  <td>{request.repaymentAmount.toLocaleString()}</td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>{request.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>🧾 Contract Readiness</h3>
            <p>Backend-generated contract calls are prepared through the admin APIs.</p>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Network
            </div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {contractMetadata?.network ?? "Unknown"}
            </div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Contract ID
            </div>
            <div style={{ fontWeight: 700, color: "var(--accent-teal)", wordBreak: "break-all" }}>
              {contractMetadata?.contractId ?? "Unknown"}
            </div>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "1rem", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Token Address
            </div>
            <div style={{ fontWeight: 700, color: "var(--accent-purple)", wordBreak: "break-all" }}>
              {contractMetadata?.tokenAddress ?? "Unknown"}
            </div>
          </div>
        </div>

        {actionLog && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.9rem 1rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(0,229,200,0.18)",
              background: "rgba(0,229,200,0.05)",
              color: "var(--text-secondary)",
            }}
          >
            {actionLog}
          </div>
        )}
      </div>
    </div>
  );
}
