import { env } from './env'

export const stellarConfig = {
  network: env.STELLAR_NETWORK,
  contractId: env.STELLAR_CONTRACT_ID,
  tokenAddress: env.STELLAR_TOKEN_ADDRESS,
  rpcUrl: env.STELLAR_RPC_URL,
  networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  readSourceAccount: env.STELLAR_READ_SOURCE_ACCOUNT,
  adminSourceAccount: env.STELLAR_ADMIN_SOURCE_ACCOUNT ?? null,
  cliPath: env.STELLAR_CLI_PATH,
  isContractConfigured:
    env.STELLAR_CONTRACT_ID !== 'invoice-finance-pool' &&
    env.STELLAR_TOKEN_ADDRESS !== 'sep41-token-address' &&
    !env.STELLAR_READ_SOURCE_ACCOUNT.startsWith('GREADSOURCEACCOUNTPLACEHOLDER'),
} as const
