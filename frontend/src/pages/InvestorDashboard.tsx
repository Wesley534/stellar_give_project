import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePool } from "../hooks/usePool";
import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";

export function InvestorDashboard() {
  
  const { walletAddress, isConnected } = useWallet();
  const { pool, deposits, deposit, withdraw, getInvestorPosition } = usePool();

  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [loading, setLoading] = useState<"deposit" | "withdraw" | null>(null);
  const [toast, setToast] = useState("");

  const { data } = useGetCurrentUser();
  const user = data?.data?.data;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const myAddress = walletAddress ?? "GDXYZ7K3ABCDEF8UVWXYZ1234567890ABCDEF";
  const position = getInvestorPosition(myAddress);

  const handleDeposit = async () => {
    const amt = Number(depositAmt);
    if (!amt || amt <= 0) return;
    setLoading("deposit");
    await deposit(amt, user?.name ?? "Investor", myAddress);
    setLoading(null);
    setDepositAmt("");
    showToast(`✅ Successfully deposited ${amt.toLocaleString()} XLM`);
  };

  const handleWithdraw = async () => {
    const shares = Number(withdrawAmt);
    if (!shares || shares <= 0) return;
    setLoading("withdraw");
    const value = await withdraw(shares);
    setLoading(null);
    setWithdrawAmt("");
    showToast(`✅ Withdrew ${value.toLocaleString()} XLM from pool`);
  };

  const utilization =
    pool.totalLiquidity > 0
      ? Math.round(
          ((pool.totalLiquidity - pool.availableLiquidity) /
            pool.totalLiquidity) *
            100,
        )
      : 0;

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
          <div className="stat-card-trend">XLM</div>
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
            XLM profit
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🏦</div>
          <div className="stat-card-label">Total Pool</div>
          <div className="stat-card-value">
            {pool.totalLiquidity.toLocaleString()}
          </div>
          <div className="stat-card-trend">XLM · {utilization}% utilized</div>
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
            <label className="form-label">Amount (XLM)</label>
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
            <span>You receive shares proportional to deposit</span>
          </div>
          <button
            className="btn btn-primary btn-full"
            onClick={handleDeposit}
            disabled={loading === "deposit" || !depositAmt}
          >
            {loading === "deposit" ? "⚡ Processing…" : "⬆ Deposit to Pool"}
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
              loading === "withdraw" || !withdrawAmt || position.shares === 0
            }
          >
            {loading === "withdraw" ? "⚡ Processing…" : "⬇ Withdraw from Pool"}
          </button>
        </div>
      </div>

      {/* Investors Table */}
      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <div className="panel-header">
          <div>
            <h3>👥 All Liquidity Providers</h3>
            <p>{deposits.length} investors in the pool</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Investor</th>
                <th>Wallet</th>
                <th>Deposited</th>
                <th>Shares</th>
                <th>Share %</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.investorName}</strong>
                  </td>
                  <td>
                    <span className="td-mono">
                      {d.walletAddress.slice(0, 12)}…
                    </span>
                  </td>
                  <td>
                    <strong>{d.amount.toLocaleString()} XLM</strong>
                  </td>
                  <td>{d.sharesReceived.toLocaleString()}</td>
                  <td>
                    <span
                      style={{ color: "var(--accent-teal)", fontWeight: 600 }}
                    >
                      {d.sharePercent}%
                    </span>
                  </td>
                  <td>{d.depositDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="toast success">
          <span>✅</span> {toast}
        </div>
      )}
    </div>
  );
}
