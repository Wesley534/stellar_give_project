import type { FinancingStatus } from '../hooks/useFinancing'

const STATUS_MAP: Record<FinancingStatus, { label: string; cls: string }> = {
  PENDING_ADMIN_REVIEW: { label: 'Pending Review', cls: 'badge-pending' },
  APPROVED:             { label: 'Approved',       cls: 'badge-approved' },
  BORROWED:             { label: 'Borrowed',       cls: 'badge-borrowed' },
  REPAID:               { label: 'Repaid',         cls: 'badge-repaid' },
  REJECTED:             { label: 'Rejected',       cls: 'badge-rejected' },
  CLOSED:               { label: 'Closed',         cls: 'badge-closed' },
}

export function StatusBadge({ status }: { status: FinancingStatus }) {
  const { label, cls } = STATUS_MAP[status] ?? { label: status, cls: '' }
  return <span className={`badge ${cls}`}>{label}</span>
}
