import { useState } from "react";
import { useFinancing } from "../hooks/useFinancing";
import { FinancingRequestCard } from "../components/FinancingRequestCard";
// import useGetCurrentUser from '../hooks/authHooks/useGetCurrentUser'

const EMPTY_FORM = {
  invoiceNumber: "",
  invoiceAmount: "",
  borrowAmount: "",
  repaymentAmount: "",
  dueDate: "",
  description: "",
};

export function BorrowerDashboard() {
  const { requests, createRequest, borrow, repay } = useFinancing();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  // const { data } = useGetCurrentUser();
  // const user = data?.data; //
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Show only this borrower's requests (in mock, show all for demo)
  const myRequests = requests;

  const active = myRequests.filter((r) =>
    ["PENDING_ADMIN_REVIEW", "APPROVED", "BORROWED"].includes(r.status),
  );
  const history = myRequests.filter((r) =>
    ["REPAID", "REJECTED", "CLOSED"].includes(r.status),
  );

  const handleSubmit = async () => {
    if (
      !form.invoiceNumber ||
      !form.invoiceAmount ||
      !form.borrowAmount ||
      !form.repaymentAmount ||
      !form.dueDate
    )
      return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    createRequest({
      invoiceNumber: form.invoiceNumber,
      invoiceAmount: Number(form.invoiceAmount),
      borrowAmount: Number(form.borrowAmount),
      repaymentAmount: Number(form.repaymentAmount),
      dueDate: form.dueDate,
      description: form.description,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    setLoading(false);
    showToast("✅ Financing request submitted for admin review");
  };

  const handleBorrow = async (id: string) => {
    await new Promise((r) => setTimeout(r, 800));
    borrow(id);
    showToast("⚡ Funds borrowed from pool via Freighter");
  };

  const handleRepay = async (id: string) => {
    await new Promise((r) => setTimeout(r, 800));
    repay(id);
    showToast("💰 Loan repaid successfully. Interest distributed.");
  };

  const totalBorrowed = myRequests
    .filter((r) => r.status === "BORROWED")
    .reduce((s, r) => s + r.borrowAmount, 0);
  const totalRepaid = myRequests
    .filter((r) => r.status === "REPAID")
    .reduce((s, r) => s + r.repaymentAmount, 0);

  return (
    <div className="animate-in">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">📋</div>
          <div className="stat-card-label">Total Requests</div>
          <div className="stat-card-value">{myRequests.length}</div>
          <div className="stat-card-trend">{active.length} active</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">⚡</div>
          <div className="stat-card-label">Currently Borrowed</div>
          <div className="stat-card-value">
            {totalBorrowed.toLocaleString()}
          </div>
          <div className="stat-card-trend">XLM outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">Total Repaid</div>
          <div className="stat-card-value">{totalRepaid.toLocaleString()}</div>
          <div className="stat-card-trend">XLM cleared</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🏆</div>
          <div className="stat-card-label">Completed Loans</div>
          <div className="stat-card-value">
            {history.filter((r) => r.status === "REPAID").length}
          </div>
          <div className="stat-card-trend">fully repaid</div>
        </div>
      </div>

      {/* Create Request */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>📝 New Financing Request</h3>
            <p>Submit an invoice to access working capital</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "✕ Cancel" : "+ New Request"}
          </button>
        </div>

        {showForm && (
          <div className="animate-in">
            <hr className="divider" />
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">Invoice Number</label>
                <input
                  className="form-input"
                  placeholder="INV-2024-001"
                  value={form.invoiceNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label className="form-label">Invoice Amount (XLM)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="10000"
                  value={form.invoiceAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceAmount: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label className="form-label">Borrow Amount (XLM)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="8000"
                  value={form.borrowAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, borrowAmount: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label className="form-label">Repayment Amount (XLM)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="8800"
                  value={form.repaymentAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, repaymentAmount: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label className="form-label">Due Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="form-field" style={{ marginTop: "1rem" }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Describe the invoice and nature of the financing request…"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: "1.25rem" }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "⚡ Submitting…" : "→ Submit for Review"}
            </button>
          </div>
        )}
      </div>

      {/* Active Requests */}
      {active.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>⚡ Active Requests</h3>
          </div>
          <div style={{ display: "grid", gap: "1rem" }}>
            {active.map((r) => (
              <FinancingRequestCard
                key={r.id}
                request={r}
                role="BORROWER"
                onBorrow={handleBorrow}
                onRepay={handleRepay}
              />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>📁 History</h3>
          </div>
          <div style={{ display: "grid", gap: "1rem" }}>
            {history.map((r) => (
              <FinancingRequestCard key={r.id} request={r} role="BORROWER" />
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast success">
          <span>✅</span> {toast}
        </div>
      )}
    </div>
  );
}
