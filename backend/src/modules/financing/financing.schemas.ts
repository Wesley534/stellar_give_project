import { FinancingStatus } from '@prisma/client'
import { z } from 'zod'

export const createFinancingSchema = z.object({
  body: z.object({
    invoiceNumber: z.string().min(1).max(100),
    invoiceAmount: z.number().positive(),
    borrowAmount: z.number().positive(),
    repaymentAmount: z.number().positive(),
    dueDate: z.iso.datetime(),
    description: z.string().min(1).max(500).optional(),
  }),
})

export const financingIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export const approveFinancingSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    action: z.enum(['APPROVE', 'REJECT']).default('APPROVE'),
    note: z.string().max(500).optional(),
  }),
})

export const repayFinancingSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().positive(),
  }),
})

export const listFinancingSchema = z.object({
  query: z.object({
    status: z.nativeEnum(FinancingStatus).optional(),
  }),
})
