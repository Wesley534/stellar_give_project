import { useState } from 'react'
import { useFinancing, type FinancingStatus } from '../hooks/useFinancing'
import { useAuth } from '../context/AuthContext'
import { FinancingRequestCard } from '../components/FinancingRequestCard'
import { StatusBadge } from '../components/StatusBadge'

const STATUS_FILTERS: { label: string; value: FinancingStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING_ADMIN_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Borrowed', value: 'BORROWED' },
  { label: 'Repaid', value: 'REPAID' },
  { label: 'Rejected', value: 'REJECTED' },
]

export function FinancingRequestsPage() {
  const { user } = useAuth()
  const { requests, approve, reject, borrow, repay } = useFinancing()
  const [filter, setFilter] = useState<FinancingStatus | 'ALL'>('ALL')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter)
  const role = user?.role ?? 'BORROWER'

  const handleApprove = (id: string) => { approve(id); showToast('✅ Request approved') }
  const handleReject  = (id: string) => { reject(id);  showToast('🚫 Request rejected') }
  const handleBorrow  = async (id: string) => { await new Promise(r => setTimeout(r, 600)); borrow(id); showToast('⚡ Funds borrowed') }
  const handleRepay   = async (id: string) => { await new Promise(r => setTimeout(r, 600)); repay(id);  showToast('💰 Loan repaid') }

  return (
    <div className="animate-in">
      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total',    value: requests.length,                                       color: 'var(--text-primary)' },
          { label: 'Pending',  value: requests.filter(r => r.status === 'PENDING_ADMIN_REVIEW').length, color: 'var(--accent-amber)' },
          { label: 'Approved', value: requests.filter(r => r.status === 'APPROVED').length,  color: 'var(--accent-cyan)' },
          { label: 'Active',   value: requests.filter(r => r.status === 'BORROWED').length,  color: 'var(--accent-purple)' },
          { label: 'Repaid',   value: requests.filter(r => r.status === 'REPAID').length,    color: 'var(--accent-green)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setFilter(label === 'Total' ? 'ALL' : label.toUpperCase() as FinancingStatus)}>
            <div className="stat-card-label">{label}</div>
            <div className="stat-card-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter + View Toggle */}
      <div className="panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  background: filter === f.value ? 'var(--accent-teal)' : 'var(--bg-elevated)',
                  color: filter === f.value ? '#05101e' : 'var(--text-secondary)',
                  transition: 'all var(--transition)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['cards', 'table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-md)', border: 'none',
                background: view === v ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.8rem', cursor: 'pointer', transition: 'all var(--transition)',
              }}>
                {v === 'cards' ? '⊞ Cards' : '≡ Table'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: '1rem' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No requests match the selected filter.</p>
          </div>
        ) : view === 'cards' ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filtered.map(r => (
              <FinancingRequestCard
                key={r.id} request={r} role={role}
                onApprove={handleApprove} onReject={handleReject}
                onBorrow={handleBorrow} onRepay={handleRepay}
              />
            ))}
          </div>
        ) : (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Borrower</th>
                    <th>Invoice</th>
                    <th>Invoice Amt</th>
                    <th>Borrow</th>
                    <th>Repayment</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td><span className="td-mono">{r.id}</span></td>
                      <td><strong>{r.borrowerName}</strong></td>
                      <td>{r.invoiceNumber}</td>
                      <td>{r.invoiceAmount.toLocaleString()} XLM</td>
                      <td><strong style={{ color: 'var(--accent-teal)' }}>{r.borrowAmount.toLocaleString()} XLM</strong></td>
                      <td>{r.repaymentAmount.toLocaleString()} XLM</td>
                      <td>{r.dueDate}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast success">{toast}</div>}
    </div>
  )
}
