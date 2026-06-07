import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import type { Role } from "../api/services/auth";
import { useWallet } from "../context/WalletContext";
import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";
import { AppShell } from "../components/AppShell";
import { AdminDashboard } from "../pages/AdminDashboard";
import { BorrowerDashboard } from "../pages/BorrowerDashboard";
import { FinancingRequestsPage } from "../pages/FinancingRequestsPage";
import { InvestorDashboard } from "../pages/InvestorDashboard";
import { LiquidityPoolPage } from "../pages/LiquidityPoolPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { getStoredToken } from "../utils/storage";

function FullPageMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-base)",
        padding: "2rem",
      }}
    >
      <div className="panel" style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <div className="empty-state" style={{ minHeight: "auto", padding: 0 }}>
          <div className="empty-icon">🛡️</div>
          <p style={{ fontSize: "1.1rem", color: "var(--text-primary)", fontWeight: 700 }}>
            {title}
          </p>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const token = getStoredToken();
  const { data, isLoading } = useGetCurrentUser();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <FullPageMessage
        title="Loading account"
        message="Fetching your profile and access permissions."
      />
    );
  }

  const user = data?.data?.data;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback =
      user.role === "ADMIN"
        ? "/admin"
        : user.role === "INVESTOR"
          ? "/investor"
          : user.role === "BORROWER"
            ? "/borrower"
            : "/financing";

    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

function RoleHomeRedirect() {
  const { data } = useGetCurrentUser();
  const user = data?.data?.data;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  if (user.role === "INVESTOR") {
    return <Navigate to="/investor" replace />;
  }

  if (user.role === "BORROWER") {
    return <Navigate to="/borrower" replace />;
  }

  return <Navigate to="/financing" replace />;
}

function AdminRoute() {
  const { walletAddress } = useWallet();
  const { data } = useGetCurrentUser();
  const user = data?.data?.data;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <AdminDashboard connectedWalletAddress={walletAddress} />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route
            path="/investor"
            element={
              <ProtectedRoute allowedRoles={["INVESTOR"]}>
                <InvestorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/borrower"
            element={
              <ProtectedRoute allowedRoles={["BORROWER"]}>
                <BorrowerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pool"
            element={
              <ProtectedRoute allowedRoles={["INVESTOR", "ADMIN"]}>
                <LiquidityPoolPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financing"
            element={
              <ProtectedRoute allowedRoles={["BORROWER", "ADMIN", "CUSTOMER", "INVESTOR"]}>
                <FinancingRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<RoleHomeRedirect />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
