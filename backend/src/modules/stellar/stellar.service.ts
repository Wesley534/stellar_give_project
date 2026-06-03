import crypto from 'crypto'

import { stellarConfig } from '../../config/stellar'

export type StellarOperation =
  | 'connect_wallet'
  | 'deposit'
  | 'withdraw'
  | 'create_financing_request'
  | 'approve_request'
  | 'borrow'
  | 'repay'

export function buildTransactionHash(operation: StellarOperation, entityId: string) {
  return `${operation}_${entityId}_${crypto.randomBytes(6).toString('hex')}`
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
