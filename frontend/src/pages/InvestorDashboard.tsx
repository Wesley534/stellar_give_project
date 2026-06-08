import { useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "../context/WalletContext";
import { usePool } from "../hooks/usePool";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function InvestorDashboard() {
  const { isConnected } = useWallet();
  const {
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
          <p>Loading investor pool metrics and your on-chain position…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-label">My Pool Value</div>
          <div className="stat-card-value">
            {position.currentValue.toLocaleString()}
          </div>
          <div className="stat-card-trend">token value</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📊</div>
          <div className="stat-card-label">My Share</div>
          <div className="stat-card-value">
            {position.sharePercent.toFixed(1)}%
          </div>
          <div className="stat-card-trend">
            {position.shares.toLocaleString()} shares
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🌱</div>
          <div className="stat-card-label">Interest Earned</div>
          <div className="stat-card-value">
            {position.earnedInterest.toLocaleString()}
          </div>
          <div
            className="stat-card-trend"
            style={{ color: "var(--accent-teal)" }}
          >
            {earnings.yieldPercentage.toFixed(2)}% yield
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🏦</div>
          <div className="stat-card-label">Total Pool</div>
          <div className="stat-card-value">
            {earnings.estimatedWithdrawableAmount.toLocaleString()}
          </div>
          <div className="stat-card-trend">withdrawable now</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* Deposit Panel */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>💧 Deposit Liquidity</h3>
              <p>Add funds to earn interest from loans</p>
            </div>
          </div>
          {!isConnected && (
            <div
              style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                fontSize: "0.84rem",
                color: "var(--accent-amber)",
              }}
            >
              ⚠️ Connect your wallet to deposit
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Amount (token units)</label>
            <input
              className="form-input"
              type="number"
              placeholder="e.g. 1000"
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              min="1"
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              margin: "0.5rem 0 1rem",
            }}
          >
            <span>The app will guide trustline setup, token funding, approval, and deposit signing in Freighter.</span>
          </div>
          <button
            className="btn btn-primary btn-full"
            onClick={handleDeposit}
            disabled={depositMutation.isPending || !depositAmt || !isConnected}
          >
            {depositMutation.isPending ? "⚡ Depositing…" : "⬆ Deposit to Pool"}
          </button>
        </div>

        {/* Withdraw Panel */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>⬇️ Withdraw Liquidity</h3>
              <p>Redeem shares for XLM + earnings</p>
            </div>
          </div>
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-md)",
              padding: "0.85rem",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Available Shares
            </span>
            <span style={{ fontWeight: 700, color: "var(--accent-teal)" }}>
              {position.shares.toLocaleString()}
            </span>
          </div>
          <div className="form-field">
            <label className="form-label">Shares to Redeem</label>
            <input
              className="form-input"
              type="number"
              placeholder="e.g. 500"
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              min="1"
              max={position.shares}
            />
          </div>
          <div style={{ margin: "0.5rem 0 1rem" }}>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, (Number(withdrawAmt) / (position.shares || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <button
            className="btn btn-secondary btn-full"
            onClick={handleWithdraw}
            disabled={
              withdrawMutation.isPending || !withdrawAmt || position.shares === 0 || !isConnected
            }
          >
            {withdrawMutation.isPending ? "⚡ Withdrawing…" : "⬇ Withdraw from Pool"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "1.5rem",
          marginTop: "1.5rem",
        }}
      >
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>🧾 My Deposit History</h3>
            <p>
              {deposits.length > 0
                ? `${deposits.length} recorded deposits into the liquidity pool`
                : "Your deposit history will appear here after successful backend-recorded funding."}
            </p>
          </div>
        </div>
        {deposits.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <p>No deposit history has been recorded for this investor yet.</p>
          </div>
        ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Funding Method</th>
                <th>Source Amount</th>
                <th>Pool Tokens</th>
                <th>Shares</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.createdAt)}</td>
                  <td><strong>{d.sourceType.replaceAll("_", " ")}</strong></td>
                  <td>{d.sourceAmount.toLocaleString()}</td>
                  <td>
                    <strong>{d.tokenAmount.toLocaleString()}</strong>
                  </td>
                  <td>{d.sharesReceived.toLocaleString()}</td>
                  <td>
                    <span className="td-mono">
                      {d.transactionHash ? `${d.transactionHash.slice(0, 10)}…` : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>📈 Recent Activity</h3>
            <p>Deposits and withdrawals recorded for your wallet</p>
          </div>
        </div>
        {activity.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <p>No investor activity has been recorded yet.</p>
          </div>
        ) : (
          activity.slice(0, 6).map((entry) => (
            <div key={entry.id} className="investor-row">
              <div
                className="investor-avatar"
                style={{
                  background:
                    entry.type === "DEPOSIT"
                      ? "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(0,229,200,0.18))"
                      : "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(167,139,250,0.18))",
                }}
              >
                {entry.type === "DEPOSIT" ? "D" : "W"}
              </div>
              <div className="investor-info">
                <strong>{entry.type === "DEPOSIT" ? "Liquidity Deposit" : "Liquidity Withdrawal"}</strong>
                <span>{formatDate(entry.createdAt)}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>
                  {entry.tokenAmount.toLocaleString()} tokens
                </div>
                <span className="badge badge-approved">
                  {entry.sharesAmount.toLocaleString()} shares
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
