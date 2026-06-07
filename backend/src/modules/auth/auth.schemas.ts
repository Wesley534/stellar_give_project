import { z } from 'zod'
import { Role } from '@prisma/client'

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.email(),
    password: z.string().min(8).max(128),
    role: z
      .enum([Role.INVESTOR, Role.BORROWER, Role.CUSTOMER])
      .optional(),
  }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
  }),
})
