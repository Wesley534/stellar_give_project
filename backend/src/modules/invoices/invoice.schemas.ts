import { z } from 'zod'

export const createInvoiceSchema = z.object({
  body: z.object({
    customerId: z.string().min(1),
    invoiceNumber: z.string().min(1).max(100),
    invoiceAmount: z.number().positive(),
    dueDate: z.string().datetime(),
  }),
})

export const invoiceIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export const listInvoicesSchema = z.object({
  query: z.object({
    status: z
      .enum([
        'PENDING_VERIFICATION',
        'VERIFIED',
        'FINANCING_REQUESTED',
        'FUNDED',
        'SETTLED',
        'CLOSED',
        'REJECTED',
      ])
      .optional(),
  }),
})

export const rejectInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})
