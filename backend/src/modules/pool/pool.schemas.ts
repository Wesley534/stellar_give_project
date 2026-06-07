import { z } from 'zod'

export const xlmDepositSchema = z.object({
  body: z.object({
    sourceAmount: z.number().positive(),
    transactionHash: z.string().min(64).max(64),
  }),
})

export const fiatSimulationDepositSchema = z.object({
  body: z.object({
    kesAmount: z.number().positive(),
  }),
})

export const contractTokenDepositSchema = z.object({
  body: z.object({
    tokenAmount: z.number().positive(),
    transactionHash: z.string().min(64).max(64),
  }),
})

export const withdrawSchema = z.object({
  body: z.object({
    shareAmount: z.number().positive(),
  }),
})
