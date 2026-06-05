// import { useState } from 'react'
import { useWallet } from "../context/WalletContext";
// import { useAuth } from '../context/AuthContext'
import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onHamburger: () => void;
  onWalletClick: () => void;
}

export function TopBar({
  title,
  subtitle,
  onHamburger,
  onWalletClick,
}: TopBarProps) {
  const { isConnected, walletAddress } = useWallet();
  // const { user } = useAuth()
  const { data } = useGetCurrentUser();
  const user = data?.data?.data; // Assuming the API response has a 'user' field
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          className="hamburger"
          onClick={onHamburger}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div className="topbar-title">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-actions">
        {/* Network badge */}
        <span
          style={{
            padding: "0.3rem 0.75rem",
            borderRadius: "var(--radius-full)",
            background: "rgba(0,229,200,0.08)",
            color: "var(--accent-teal)",
            fontSize: "0.75rem",
            fontWeight: 700,
            border: "1px solid rgba(0,229,200,0.15)",
          }}
        >
          ✦ Testnet
        </span>

        {/* Wallet button */}
        <button
          onClick={onWalletClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius-md)",
            background: isConnected
              ? "rgba(52,211,153,0.08)"
              : "var(--bg-elevated)",
            border: isConnected
              ? "1px solid rgba(52,211,153,0.25)"
              : "1px solid var(--border)",
            color: isConnected
              ? "var(--accent-green)"
              : "var(--text-secondary)",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all var(--transition)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isConnected
                ? "var(--accent-green)"
                : "var(--text-muted)",
              boxShadow: isConnected ? "0 0 6px var(--accent-green)" : "none",
              flexShrink: 0,
            }}
          />
          {isConnected ? shortAddr : "Connect Wallet"}
        </button>

        {/* Avatar */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, var(--accent-teal), var(--accent-purple))",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: "0.8rem",
            color: "#05101e",
            flexShrink: 0,
            cursor: "default",
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
