import { Role } from '@prisma/client'

import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { signJwt } from '../../utils/jwt'
import { comparePassword, hashPassword } from '../../utils/password'
import { findUserByEmail } from '../users/user.service'
import { SafeUser, toSafeUser } from '../users/user.model'

type AuthPayload = {
  user: SafeUser
  token: string
}

type RegisterInput = {
  name: string
  email: string
  password: string
  role?: Role
}

type LoginInput = {
  email: string
  password: string
}

export async function registerUser(input: RegisterInput): Promise<AuthPayload> {
  const normalizedEmail = input.email.toLowerCase()
  const existingUser = await findUserByEmail(normalizedEmail)

  if (existingUser) {
    throw new AppError('A user with that email already exists', 409)
  }

  const passwordHash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: normalizedEmail,
      passwordHash,
      role: input.role ?? Role.BORROWER,
    },
  })

  const safeUser = toSafeUser(user)

  return {
    user: safeUser,
    token: signJwt({
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    }),
  }
}

export async function loginUser(input: LoginInput): Promise<AuthPayload> {
  const normalizedEmail = input.email.toLowerCase()
  const user = await findUserByEmail(normalizedEmail)

  if (!user) {
    throw new AppError('Invalid email or password', 401)
  }

  const isValid = await comparePassword(input.password, user.passwordHash)

  if (!isValid) {
    throw new AppError('Invalid email or password', 401)
  }

  const safeUser = toSafeUser(user)

  return {
    user: safeUser,
    token: signJwt({
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    }),
  }
}
