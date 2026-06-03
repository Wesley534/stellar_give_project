import { env } from './env'

export const stellarConfig = {
  network: env.STELLAR_NETWORK,
  contractId: env.STELLAR_CONTRACT_ID,
  tokenAddress: env.STELLAR_TOKEN_ADDRESS,
} as const
