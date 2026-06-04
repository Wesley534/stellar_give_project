import { FinancingStatus } from '@prisma/client'
import { z } from 'zod'

export const createFinancingSchema = z.object({
  body: z.object({
    invoiceId: z.string().min(1),
  }),
})

export const financingIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export const reviewFinancingSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    note: z.string().max(500).optional(),
  }),
})

export const listFinancingSchema = z.object({
  query: z.object({
    status: z.nativeEnum(FinancingStatus).optional(),
  }),
})
