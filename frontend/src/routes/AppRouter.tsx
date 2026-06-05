import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { LoginPage } from "../pages/LoginPage";
import { InvestorDashboard } from "../pages/InvestorDashboard";
import { BorrowerDashboard } from "../pages/BorrowerDashboard";
import { AdminDashboard } from "../pages/AdminDashboard";
import { LiquidityPoolPage } from "../pages/LiquidityPoolPage";
import { FinancingRequestsPage } from "../pages/FinancingRequestsPage";
import { NotFoundPage } from "../pages/NotFoundPage";

import useGetCurrentUser from "../hooks/authHooks/useGetCurrentUser";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const getToken = localStorage.getItem("token") || "null";

  const { data, isLoading } = useGetCurrentUser();
  console.log("ProtectedRoute - getCurrentUser data:", data);
  if (isLoading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-base)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "2rem",
              marginBottom: "1rem",
              animation: "spin-slow 1.5s linear infinite",
              display: "inline-block",
            }}
          >
            ⚡
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Loading…
          </div>
        </div>
      </div>
    );

  if (!getToken) return <Navigate to="/" replace />;
  return <>{children}</>;
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
          <Route path="/investor" element={<InvestorDashboard />} />
          <Route path="/borrower" element={<BorrowerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/pool" element={<LiquidityPoolPage />} />
          <Route path="/financing" element={<FinancingRequestsPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
