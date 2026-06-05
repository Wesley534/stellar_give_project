import { useState } from "react";
import { usePool } from "../hooks/usePool";
import { useWallet } from "../context/WalletContext";
import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";

export function LiquidityPoolPage() {
  const { walletAddress } = useWallet();
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

  const myAddr = walletAddress ?? "GDXYZ7K3ABCDEF8UVWXYZ1234567890ABCDEF";
  const position = getInvestorPosition(myAddr);

  const utilization =
    pool.totalLiquidity > 0
      ? Math.round(
          ((pool.totalLiquidity - pool.availableLiquidity) /
            pool.totalLiquidity) *
            100,
        )
      : 0;

  // SVG donut ring values
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const utilStroke = (utilization / 100) * circumference;

  const handleDeposit = async () => {
    const amt = Number(depositAmt);
    if (!amt) return;
    setLoading("deposit");
    await deposit(amt, user?.name ?? "Investor", myAddr);
    setLoading(null);
    setDepositAmt("");
    showToast(`Deposited ${amt.toLocaleString()} XLM into pool`);
  };

  const handleWithdraw = async () => {
    const shares = Number(withdrawAmt);
    if (!shares) return;
    setLoading("withdraw");
    const val = await withdraw(shares);
    setLoading(null);
    setWithdrawAmt("");
    showToast(`Withdrew ${val.toLocaleString()} XLM from pool`);
  };

  return (
    <div className="animate-in">
      {/* Top row: ring + stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: "1.5rem",
          marginBottom: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Pool Ring */}
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
          <h3 style={{ fontSize: "0.9rem", fontWeight: 700 }}>
            Pool Utilization
          </h3>
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
              {pool.availableLiquidity.toLocaleString()} XLM
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
              {(pool.totalLiquidity - pool.availableLiquidity).toLocaleString()}{" "}
              XLM
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon">🏦</div>
              <div className="stat-card-label">Total Liquidity</div>
              <div className="stat-card-value">
                {pool.totalLiquidity.toLocaleString()}
              </div>
              <div className="stat-card-trend">XLM in pool</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon">🎟</div>
              <div className="stat-card-label">Total Shares</div>
              <div className="stat-card-value">
                {pool.totalShares.toLocaleString()}
              </div>
              <div className="stat-card-trend">
                across {deposits.length} investors
              </div>
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
              <div
                className="stat-card-trend"
                style={{ color: "var(--accent-green)" }}
              >
                XLM distributed
              </div>
            </div>
          </div>

          {/* My position */}
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
                  {
                    label: "Shares",
                    value: `${position.shares.toLocaleString()}`,
                  },
                  {
                    label: "Share %",
                    value: `${position.sharePercent.toFixed(1)}%`,
                  },
                  {
                    label: "Value",
                    value: `${position.currentValue.toLocaleString()} XLM`,
                  },
                  {
                    label: "Earned",
                    value: `${position.earnedInterest.toLocaleString()} XLM`,
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ fontWeight: 700, color: "var(--accent-teal)" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit / Withdraw */}
      {user?.role !== "ADMIN" && (
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
              <label className="form-label">Amount (XLM)</label>
              <input
                className="form-input"
                type="number"
                placeholder="1000"
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: "1rem" }}
              onClick={handleDeposit}
              disabled={loading === "deposit" || !depositAmt}
            >
              {loading === "deposit" ? "⚡ Processing…" : "⬆ Deposit to Pool"}
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
              disabled={loading === "withdraw" || !withdrawAmt}
            >
              {loading === "withdraw"
                ? "⚡ Processing…"
                : "⬇ Withdraw from Pool"}
            </button>
          </div>
        </div>
      )}

      {/* Investor Breakdown */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>👥 Investor Breakdown</h3>
            <p>{deposits.length} liquidity providers</p>
          </div>
        </div>
        {deposits.map((d) => (
          <div key={d.id} className="investor-row">
            <div className="investor-avatar">
              {d.investorName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="investor-info">
              <strong>{d.investorName}</strong>
              <span className="font-mono">{d.walletAddress.slice(0, 14)}…</span>
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div style={{ width: 80 }}>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${d.sharePercent}%` }}
                    />
                  </div>
                </div>
                <span className="investor-share">{d.sharePercent}%</span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.2rem",
                  textAlign: "right",
                }}
              >
                {d.amount.toLocaleString()} XLM
              </div>
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div className="toast success">
          <span>✅</span> {toast}
        </div>
      )}
    </div>
  );
}
