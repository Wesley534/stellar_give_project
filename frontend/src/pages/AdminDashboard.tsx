import { useState } from 'react'
import { useFinancing } from '../hooks/useFinancing'
import { usePool } from '../hooks/usePool'
import { FinancingRequestCard } from '../components/FinancingRequestCard'
import { StatusBadge } from '../components/StatusBadge'

export function AdminDashboard() {
  const { requests, approve, reject } = useFinancing()
  const { pool } = usePool()
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const pending = requests.filter(r => r.status === 'PENDING_ADMIN_REVIEW')
  const approved = requests.filter(r => r.status === 'APPROVED')
  const borrowed = requests.filter(r => r.status === 'BORROWED')
  const repaid = requests.filter(r => r.status === 'REPAID')

  const handleApprove = (id: string) => { approve(id); showToast('✅ Request approved') }
  const handleReject = (id: string) => { reject(id); showToast('🚫 Request rejected') }

  const utilizationPct = pool.totalLiquidity > 0
    ? Math.round(((pool.totalLiquidity - pool.availableLiquidity) / pool.totalLiquidity) * 100)
    : 0

  return (
    <div className="animate-in">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">Pending Review</div>
          <div className="stat-card-value">{pending.length}</div>
          <div className="stat-card-trend" style={{ color: 'var(--accent-amber)' }}>awaiting action</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💧</div>
          <div className="stat-card-label">Pool Liquidity</div>
          <div className="stat-card-value">{pool.totalLiquidity.toLocaleString()}</div>
          <div className="stat-card-trend">{utilizationPct}% utilized</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📤</div>
          <div className="stat-card-label">Active Loans</div>
          <div className="stat-card-value">{borrowed.length}</div>
          <div className="stat-card-trend">{borrowed.reduce((s, r) => s + r.borrowAmount, 0).toLocaleString()} XLM out</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💸</div>
          <div className="stat-card-label">Interest Earned</div>
          <div className="stat-card-value">{pool.totalInterestEarned.toLocaleString()}</div>
          <div className="stat-card-trend" style={{ color: 'var(--accent-green)' }}>XLM distributed</div>
        </div>
      </div>

      {/* Pool Health */}
      <div className="panel">
        <div className="panel-header">
          <h3>🏦 Pool Health</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
          {[
            { label: 'Total Liquidity', value: `${pool.totalLiquidity.toLocaleString()} XLM`, color: 'var(--accent-teal)' },
            { label: 'Available', value: `${pool.availableLiquidity.toLocaleString()} XLM`, color: 'var(--accent-green)' },
            { label: 'On Loan', value: `${(pool.totalLiquidity - pool.availableLiquidity).toLocaleString()} XLM`, color: 'var(--accent-purple)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{label}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div className="progress-fill" style={{ width: `${utilizationPct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          <span>Pool Utilization</span>
          <span style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{utilizationPct}%</span>
        </div>
      </div>

      {/* Pending Review Queue */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>⏳ Pending Review Queue</h3>
            <p>{pending.length} request{pending.length !== 1 ? 's' : ''} awaiting your decision</p>
          </div>
        </div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p>All caught up! No pending requests.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {pending.map(r => (
              <FinancingRequestCard key={r.id} request={r} role="ADMIN" onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}
      </div>

      {/* All Requests Summary Table */}
      <div className="panel">
        <div className="panel-header">
          <h3>📋 All Financing Requests</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Borrower</th>
                <th>Invoice</th>
                <th>Borrow</th>
                <th>Repayment</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td><span className="td-mono">{r.id}</span></td>
                  <td><strong>{r.borrowerName}</strong></td>
                  <td>{r.invoiceNumber}</td>
                  <td><strong>{r.borrowAmount.toLocaleString()} XLM</strong></td>
                  <td>{r.repaymentAmount.toLocaleString()} XLM</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="toast success"><span>✅</span> {toast}</div>}
    </div>
  )
}
