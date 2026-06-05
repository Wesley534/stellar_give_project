import { NavLink, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { BlockchainIcon } from "./BlockchainIcon";
import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const INVESTOR_NAV = [
  { icon: "📊", label: "Dashboard", to: "/investor" },
  { icon: "💧", label: "Liquidity Pool", to: "/pool" },
  { icon: "📋", label: "My Requests", to: "/financing" },
];

const BORROWER_NAV = [
  { icon: "📊", label: "Dashboard", to: "/borrower" },
  { icon: "📋", label: "Financing Requests", to: "/financing" },
];

const ADMIN_NAV = [
  { icon: "🛡️", label: "Dashboard", to: "/admin" },
  { icon: "💧", label: "Liquidity Pool", to: "/pool" },
  { icon: "📋", label: "All Requests", to: "/financing" },
];

const ROLE_COLORS: Record<string, string> = {
  INVESTOR: "badge-investor",
  BORROWER: "badge-borrower",
  ADMIN: "badge-admin",
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { data } = useGetCurrentUser();
  const user = data?.data?.data;
  const { walletAddress, isConnected } = useWallet();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const navItems =
    user?.role === "INVESTOR"
      ? INVESTOR_NAV
      : user?.role === "BORROWER"
        ? BORROWER_NAV
        : ADMIN_NAV;

  const handleLogout = () => {
    localStorage.removeItem("token");
    queryClient.clear();
    toast.success("Logged out successfully");
    navigate("/");
    onClose();
  };

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : "Not connected";

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99,
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={onClose}
        />
      )}
      <aside className={`sidebar${isOpen ? " open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <BlockchainIcon size={24} />
          </div>
          <div>
            <h1>StellarGive</h1>
            <span>Invoice Finance</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onClose}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {/* User info */}
          {user && (
            <>
              <div
                className="sidebar-section-label"
                style={{ marginTop: "1rem" }}
              >
                Account
              </div>
              <div
                style={{
                  padding: "0.75rem 0.9rem",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "0.25rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    color: "var(--text-primary)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {user.email}
                </div>
                <span className={`badge ${ROLE_COLORS[user.role]}`}>
                  {user.role}
                </span>
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="wallet-chip" style={{ marginBottom: "0.5rem" }}>
            <span className={`dot${isConnected ? " connected" : ""}`} />
            <span className="addr">{shortAddr}</span>
          </div>
          <button
            className="nav-btn"
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.7rem 0.9rem",
              borderRadius: "var(--radius-md)",
              color: "var(--accent-red)",
              fontSize: "0.9rem",
              fontWeight: 500,
              background: "none",
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
