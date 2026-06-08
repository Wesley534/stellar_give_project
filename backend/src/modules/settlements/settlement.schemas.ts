import { z } from 'zod'

export const settlementIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export const finalizeSettlementSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    transactionHash: z.string().min(64).max(64),
  }),
})
