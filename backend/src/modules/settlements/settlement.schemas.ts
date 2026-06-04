import { z } from 'zod'

export const settlementIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})
