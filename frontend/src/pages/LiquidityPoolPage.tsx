import { useState } from "react";
import toast from "react-hot-toast";

import { useWallet } from "../context/WalletContext";
import { usePool } from "../hooks/usePool";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function LiquidityPoolPage() {
  const { isConnected } = useWallet();
  const {
    pool,
    earnings,
    deposits,
    activity,
    position,
    deposit,
    withdraw,
    poolQuery,
    positionQuery,
    earningsQuery,
    depositsQuery,
    activityQuery,
    contractMetadataQuery,
    depositMutation,
    withdrawMutation,
  } = usePool();
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const utilization =
    pool.totalLiquidity > 0
      ? Math.round(
          ((pool.totalLiquidity - pool.availableLiquidity) / pool.totalLiquidity) * 100,
        )
      : 0;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const utilStroke = (utilization / 100) * circumference;

  const handleDeposit = async () => {
    const amt = Number(depositAmt);
    if (!amt || amt <= 0) return;

    const response = await deposit(amt);
    setDepositAmt("");
    toast.success(
      `Liquidity deposited successfully. On-chain hash: ${response.depositSubmission.hash.slice(0, 12)}…`,
    );
  };

  const handleWithdraw = async () => {
    const shares = Number(withdrawAmt);
    if (!shares || shares <= 0) return;

    const response = await withdraw(shares);
    setWithdrawAmt("");
    toast.success(
      `Withdrawal submitted successfully. On-chain hash: ${response.withdrawSubmission.hash.slice(0, 12)}…`,
    );
  };

  if (
    poolQuery.isLoading ||
    positionQuery.isLoading ||
    earningsQuery.isLoading ||
    depositsQuery.isLoading ||
    activityQuery.isLoading ||
    contractMetadataQuery.isLoading
  ) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-icon">⚡</div>
          <p>Loading live pool metrics and investor position…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: "1.5rem",
          marginBottom: "1.5rem",
          alignItems: "start",
        }}
      >
        <div
          className="panel"
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700 }}>Pool Utilization</h3>
          <div className="pool-ring">
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="18"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="url(#poolGrad)"
                strokeWidth="18"
                strokeDasharray={`${utilStroke} ${circumference}`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="poolGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent-teal)" />
                  <stop offset="100%" stopColor="var(--accent-purple)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="pool-ring-label">
              <strong>{utilization}%</strong>
              <span>utilized</span>
            </div>
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Available</span>
            <span style={{ color: "var(--accent-green)", fontWeight: 700 }}>
              {pool.availableLiquidity.toLocaleString()} tokens
            </span>
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>On Loan</span>
            <span style={{ color: "var(--accent-purple)", fontWeight: 700 }}>
              {pool.outstandingPrincipal.toLocaleString()} tokens
            </span>
          </div>
        </div>

        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon">🏦</div>
              <div className="stat-card-label">Total Liquidity</div>
              <div className="stat-card-value">{pool.totalLiquidity.toLocaleString()}</div>
              <div className="stat-card-trend">tokens in pool</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">🎟</div>
              <div className="stat-card-label">Total Shares</div>
              <div className="stat-card-value">{pool.totalShares.toLocaleString()}</div>
              <div className="stat-card-trend">share price {pool.sharePrice.toFixed(4)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">📤</div>
              <div className="stat-card-label">Active Loans</div>
              <div className="stat-card-value">{pool.totalLoans}</div>
              <div className="stat-card-trend">financing outstanding</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">💸</div>
              <div className="stat-card-label">Interest Earned</div>
              <div className="stat-card-value">
                {pool.totalInterestEarned.toLocaleString()}
              </div>
              <div className="stat-card-trend" style={{ color: "var(--accent-green)" }}>
                your yield {earnings.yieldPercentage.toFixed(2)}%
              </div>
            </div>
          </div>

          {position.shares > 0 && (
            <div
              style={{
                marginTop: "1rem",
                background:
                  "linear-gradient(135deg, rgba(0,229,200,0.06), rgba(167,139,250,0.06))",
                border: "1px solid var(--border-bright)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem 1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginBottom: "0.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                My Position
              </div>
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                {[
                  { label: "Shares", value: `${position.shares.toLocaleString()}` },
                  { label: "Share %", value: `${position.sharePercent.toFixed(1)}%` },
                  { label: "Value", value: `${position.currentValue.toLocaleString()} tokens` },
                  {
                    label: "Deposited",
                    value: `${position.deposited.toLocaleString()} tokens`,
                  },
                  {
                    label: "Earned",
                    value: `${position.earnedInterest.toLocaleString()} tokens`,
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {label}
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--accent-teal)" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>⬆ Deposit</h3>
          </div>
          <div className="form-field">
            <label className="form-label">Amount (token units)</label>
            <input
              className="form-input"
              type="number"
              placeholder="1000"
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
            />
          </div>
          <div
            style={{
              marginTop: "0.6rem",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            The app will handle trustline setup, funding, approval, and deposit signing for you.
          </div>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: "1rem" }}
            onClick={handleDeposit}
            disabled={depositMutation.isPending || !depositAmt || !isConnected}
          >
            {depositMutation.isPending ? "⚡ Depositing…" : "⬆ Deposit to Pool"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>⬇ Withdraw</h3>
          </div>
          <div className="form-field">
            <label className="form-label">Shares to Redeem</label>
            <input
              className="form-input"
              type="number"
              placeholder="500"
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: "1rem" }}
            onClick={handleWithdraw}
            disabled={withdrawMutation.isPending || !withdrawAmt || !isConnected}
          >
            {withdrawMutation.isPending ? "⚡ Withdrawing…" : "⬇ Withdraw from Pool"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>🧾 My Funding History</h3>
            <p>
              {deposits.length > 0
                ? `${deposits.length} deposit records tracked for this investor`
                : "Live aggregate pool data is connected. Your personal funding records will appear here once deposits are recorded."}
            </p>
          </div>
        </div>
        {deposits.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <p>No investor deposit history is available yet.</p>
          </div>
        ) : (
          deposits.map((d) => (
            <div key={d.id} className="investor-row">
              <div className="investor-avatar">💧</div>
              <div className="investor-info">
                <strong>{d.sourceType.replaceAll("_", " ")}</strong>
                <span>{formatDate(d.createdAt)}</span>
              </div>
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{d.tokenAmount.toLocaleString()} tokens</span>
                  <span className="badge badge-approved">
                    {d.sharesReceived.toLocaleString()} shares
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <div className="panel-header">
          <div>
            <h3>📈 Activity Timeline</h3>
            <p>Your latest liquidity actions across deposits and withdrawals</p>
          </div>
        </div>
        {activity.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <p>No pool activity has been recorded for this wallet yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Tokens</th>
                  <th>Shares</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>
                      <span className="badge badge-approved">
                        {entry.type}
                      </span>
                    </td>
                    <td>{entry.tokenAmount.toLocaleString()}</td>
                    <td>{entry.sharesAmount.toLocaleString()}</td>
                    <td>
                      <span className="td-mono">
                        {entry.transactionHash ? `${entry.transactionHash.slice(0, 10)}…` : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
