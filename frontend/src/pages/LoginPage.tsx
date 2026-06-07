import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BlockchainIcon } from "../components/BlockchainIcon";
import useLogin from "../hooks/authHooks/useLogin";
import useRegister from "../hooks/authHooks/useRegister";
import { toast } from "react-hot-toast";

export type Role = "INVESTOR" | "BORROWER" | "CUSTOMER" | "ADMIN";
type RegisterRole = Exclude<Role, "ADMIN">;

const ROLE_OPTIONS: {
  role: RegisterRole;
  icon: string;
  label: string;
  desc: string;
}[] = [
  {
    role: "INVESTOR",
    icon: "💼",
    label: "Investor",
    desc: "Provide liquidity, earn returns",
  },
  {
    role: "BORROWER",
    icon: "🏢",
    label: "Borrower",
    desc: "Finance your invoices",
  },
  {
    role: "CUSTOMER",
    icon: "🧾",
    label: "Customer",
    desc: "Verify and settle invoices",
  },
];

const ROLE_REDIRECT: Record<Role, string> = {
  INVESTOR: "/investor",
  BORROWER: "/borrower",
  CUSTOMER: "/financing",
  ADMIN: "/admin",
};

export function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [selectedRole, setSelectedRole] = useState<RegisterRole>("INVESTOR");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const { mutate: login, isPending: isLoginPending } = useLogin();
  const { mutate: register, isPending: isRegisterPending } = useRegister();

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError("");
    // setLoading(true);
    try {
      if (tab === "login") {
        await login(
          { email, password },
          {
            onSuccess: (data) => {
              navigate(ROLE_REDIRECT[data?.data?.data?.user?.role as Role]);
            },
            onError: (err: unknown) => {
              setError("Invalid email or password");
              console.log("Login error:", err);
              toast.error(
                "Login failed. Please check your credentials and try again.",
              );
            },
          },
        );
      } else {
        if (!name.trim()) {
          setError("Name is required");
          // setLoading(false);
          return;
        }
        await register(
          { name, email, password, role: selectedRole },
          {
            onSuccess: (data) => {
              navigate(ROLE_REDIRECT[data?.data?.data?.user?.role as Role]);
              // navigate(ROLE_REDIRECT[selectedRole]);
            },
          },
        );
      }
    } catch {
      setError("Authentication failed. Please try again.");
    } finally {
      // setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Hero Panel */}
      <div className="auth-hero">
        <div className="auth-hero-logo">
          <div className="auth-hero-logo-icon">
            <BlockchainIcon size={28} />
          </div>
          <div>
            <h1>StellarGive</h1>
            <p>Invoice Finance Platform</p>
          </div>
        </div>
        <div className="auth-hero-content animate-in">
          <h2>
            Unlock Working Capital with
            <br />
            <span>Blockchain-Powered</span>
            <br />
            Invoice Financing
          </h2>
          <p>
            A decentralized liquidity pool connecting investors and businesses
            through Stellar smart contracts — transparent, fast, and
            permissionless.
          </p>
        </div>

        <div className="auth-hero-stats animate-in">
          <div className="auth-stat">
            <strong>10,800</strong>
            <span>Pool Liquidity (XLM)</span>
          </div>
          <div className="auth-stat">
            <strong>8%</strong>
            <span>Avg. Interest Rate</span>
          </div>
          <div className="auth-stat">
            <strong>5</strong>
            <span>Active Requests</span>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth-form-panel">
        <h2>{tab === "login" ? "Welcome back" : "Create account"}</h2>
        <p>
          {tab === "login"
            ? "Sign in to access your dashboard"
            : "Join the platform as an investor, borrower, or customer"}
        </p>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === "login" ? " active" : ""}`}
            onClick={() => {
              setTab("login");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab${tab === "register" ? " active" : ""}`}
            onClick={() => {
              setTab("register");
              setError("");
            }}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === "register" && (
            <div>
              <div className="form-label" style={{ marginBottom: "0.5rem" }}>
                Select Role
              </div>
              <div className="role-selector">
                {ROLE_OPTIONS.map(({ role, icon, label }) => (
                  <div
                    key={role}
                    className={`role-option${selectedRole === role ? " selected" : ""}`}
                    onClick={() => setSelectedRole(role)}
                  >
                    <div className="role-icon">{icon}</div>
                    <div className="role-name">{label}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                }}
              >
                Admin accounts are provisioned separately and cannot be self-registered.
              </div>
            </div>
          )}

          {tab === "register" && (
            <div className="form-field">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Jane Kimani"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoginPending || isRegisterPending}
                required
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoginPending || isRegisterPending}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoginPending || isRegisterPending}
              required
            />
          </div>

          {error && (
            <div
              style={{
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 1rem",
                color: "var(--accent-red)",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-full btn-lg"
            type="submit"
            disabled={isLoginPending || isRegisterPending}
          >
            {isLoginPending
              ? "⚡ Connecting…"
              : tab === "login"
                ? "→ Sign In"
                : "→ Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
