import type { FinancingRequest } from '../hooks/useFinancing'
import { StatusBadge } from './StatusBadge'

interface Props {
  request: FinancingRequest
  role: 'INVESTOR' | 'BORROWER' | 'ADMIN' | 'CUSTOMER'
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onBorrow?: (id: string) => void
  onRepay?: (id: string) => void
}

export function FinancingRequestCard({ request, role, onApprove, onReject, onBorrow, onRepay }: Props) {
  const interestRate = Math.round(((request.repaymentAmount - request.borrowAmount) / request.borrowAmount) * 100)

  return (
    <div className="request-card animate-in">
      <div className="request-card-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {request.invoiceNumber}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {request.borrowerName} · Due {request.dueDate}
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>
        {request.description}
      </p>

      <div className="request-card-amounts">
        <div className="amount-item">
          <span className="amount-label">Invoice Value</span>
          <span className="amount-value">{request.invoiceAmount.toLocaleString()} XLM</span>
        </div>
        <div className="amount-item">
          <span className="amount-label">Borrow Amount</span>
          <span className="amount-value highlight">{request.borrowAmount.toLocaleString()} XLM</span>
        </div>
        <div className="amount-item">
          <span className="amount-label">Repayment ({interestRate}%)</span>
          <span className="amount-value">{request.repaymentAmount.toLocaleString()} XLM</span>
        </div>
      </div>

      <div className="request-card-actions">
        {role === 'ADMIN' && request.status === 'PENDING_ADMIN_REVIEW' && (
          <>
            <button className="btn btn-success btn-sm" onClick={() => onApprove?.(request.id)}>✓ Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => onReject?.(request.id)}>✗ Reject</button>
          </>
        )}
        {role === 'BORROWER' && request.status === 'APPROVED' && (
          <button className="btn btn-primary btn-sm" onClick={() => onBorrow?.(request.id)}>⚡ Borrow Funds</button>
        )}
        {role === 'BORROWER' && request.status === 'BORROWED' && (
          <button className="btn btn-purple btn-sm" onClick={() => onRepay?.(request.id)}>💰 Repay Loan</button>
        )}
      </div>

      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {request.id}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Created {request.createdAt}
        </span>
      </div>
    </div>
  )
}
