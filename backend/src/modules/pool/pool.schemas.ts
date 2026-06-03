import { z } from 'zod'

export const depositSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
  }),
})

export const withdrawSchema = z.object({
  body: z.object({
    shareAmount: z.number().positive(),
  }),
})
