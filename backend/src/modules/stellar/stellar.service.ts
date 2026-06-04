import crypto from 'crypto'

import { stellarConfig } from '../../config/stellar'

export type StellarOperation =
  | 'connect_wallet'
  | 'record_xlm_deposit'
  | 'simulate_fiat_deposit'
  | 'withdraw_liquidity'
  | 'create_invoice'
  | 'verify_invoice'
  | 'reject_invoice'
  | 'request_financing'
  | 'approve_financing'
  | 'reject_financing'
  | 'borrow'
  | 'settle_invoice'

export function buildTransactionHash(operation: StellarOperation, entityId: string) {
  return `${operation}_${entityId}_${crypto.randomBytes(6).toString('hex')}`
}

export function buildContractInvoiceId(invoiceId: string) {
  return `inv_${invoiceId}`
}

export function buildContractRequestId(requestId: string) {
  return `req_${requestId}`
}

export function getStellarMetadata() {
  return {
    network: stellarConfig.network,
    contractId: stellarConfig.contractId,
    tokenAddress: stellarConfig.tokenAddress,
  }
}
