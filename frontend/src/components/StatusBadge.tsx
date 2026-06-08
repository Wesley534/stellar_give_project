// Removed FinancingStatus import as it is no longer needed

export type StatusBadgeStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'APPROVED'
  | 'BORROWED'
  | 'REPAID'
  | 'REJECTED'
  | 'CLOSED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'FINANCING_REQUESTED'
  | 'FUNDED'
  | 'SETTLED';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING_ADMIN_REVIEW: { label: 'Pending Review', cls: 'badge-pending' },
  APPROVED:             { label: 'Approved',       cls: 'badge-approved' },
  BORROWED:             { label: 'Borrowed',       cls: 'badge-borrowed' },
  REPAID:               { label: 'Repaid',         cls: 'badge-repaid' },
  REJECTED:             { label: 'Rejected',       cls: 'badge-rejected' },
  CLOSED:               { label: 'Closed',         cls: 'badge-closed' },
  PENDING_VERIFICATION: { label: 'Pending Verification', cls: 'badge-pending' },
  VERIFIED:             { label: 'Verified',             cls: 'badge-approved' },
  FINANCING_REQUESTED:  { label: 'Financing Requested',  cls: 'badge-purple' },
  FUNDED:              { label: 'Funded',               cls: 'badge-borrowed' },
  SETTLED:             { label: 'Settled',              cls: 'badge-repaid' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, cls } = STATUS_MAP[status] ?? { label: status, cls: '' }
  return <span className={`badge ${cls}`}>{label}</span>
}
