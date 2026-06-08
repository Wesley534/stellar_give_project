import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  ADMIN_NAME: z.string().min(1),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(8),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  FRONTEND_URL: z.string().url(),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_CONTRACT_ID: z.string().min(1).default('invoice-finance-pool'),
  STELLAR_TOKEN_ADDRESS: z.string().min(1).default('sep41-token-address'),
  STELLAR_RPC_URL: z.string().url().default('https://soroban-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .min(1)
    .default('Test SDF Network ; September 2015'),
  STELLAR_READ_SOURCE_ACCOUNT: z
    .string()
    .min(1)
    .default('GREADSOURCEACCOUNTPLACEHOLDERREADSOURCEACCOUNTPLACEHOLDER'),
  STELLAR_ADMIN_SOURCE_ACCOUNT: z.string().min(1).optional(),
  STELLAR_ADMIN_SECRET_KEY: z.string().min(1).optional(),
  STELLAR_READ_SECRET_KEY: z.string().min(1).optional(),
  STELLAR_CLI_PATH: z.string().min(1).default('stellar'),
  STELLAR_TOKEN_TRUSTLINE_ASSET: z.string().min(1).optional(),
  STELLAR_TOKEN_ISSUER_ACCOUNT: z.string().min(1).optional(),
  STELLAR_TOKEN_ISSUER_SECRET_KEY: z.string().min(1).optional(),
  STELLAR_TREASURY_WALLET: z
    .string()
    .min(1)
    .default('TREASURY_TESTNET_WALLET'),
})

export const env = envSchema.parse(process.env)
