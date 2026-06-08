import { z } from 'zod'

const stellarAddress = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Wallet address must be a valid Stellar public key')

export const contractIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export const depositBuildSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
  }),
})

export const withdrawBuildSchema = z.object({
  body: z.object({
    shareAmount: z.number().positive(),
  }),
})

export const tokenApproveBuildSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
  }),
})

export const submitSignedTransactionSchema = z.object({
  body: z.object({
    signedXdr: z.string().min(1),
  }),
})

export const createInvoiceBuildSchema = z.object({
  body: z.object({
    customer: stellarAddress,
    invoiceNumber: z.string().min(1).max(100),
    invoiceAmount: z.number().positive(),
    dueDate: z.coerce.number().int().positive(),
  }),
})

export const requestFinancingBuildSchema = z.object({
  body: z.object({
    invoiceId: z.number().int().positive(),
    advanceRateBps: z.number().int().min(1).max(10_000),
    interestRateBps: z.number().int().min(0).max(10_000),
    processingFeeBps: z.number().int().min(0).max(2_000),
  }),
})

export const withdrawPlatformFeesSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
  }),
})
