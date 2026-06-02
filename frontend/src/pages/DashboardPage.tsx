export function DashboardPage() {
  return (
    <section className="dashboard-grid">
      <div className="panel">
        <span className="eyebrow">Dashboard</span>
        <h2>Operations snapshot</h2>
        <p>
          This is a placeholder for pipeline metrics, funded invoices, approvals,
          and customer activity.
        </p>

        <ul className="quick-list">
          <li>Pending invoice reviews</li>
          <li>Recent financing requests</li>
          <li>Repayment and collections activity</li>
        </ul>
      </div>

      <div className="stat-card">
        <h3>Next frontend steps</h3>
        <p>
          Connect this page to the auth endpoints, store the JWT, and hydrate
          dashboard widgets from backend APIs as they are added.
        </p>
      </div>
    </section>
  )
}
