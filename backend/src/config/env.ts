import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  FRONTEND_URL: z.string().url(),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_CONTRACT_ID: z.string().min(1).default('invoice-finance-pool'),
  STELLAR_TOKEN_ADDRESS: z.string().min(1).default('sep41-token-address'),
})

export const env = envSchema.parse(process.env)
