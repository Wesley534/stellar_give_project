import { WalletNetwork } from '@prisma/client'
import { z } from 'zod'

const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Wallet address must be a valid Stellar public key')

export const connectWalletSchema = z.object({
  body: z.object({
    walletAddress: stellarAddressSchema,
    network: z.nativeEnum(WalletNetwork).default(WalletNetwork.TESTNET),
  }),
})
