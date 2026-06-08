import { prisma } from '../../config/prisma'
import { Role } from '@prisma/client'

import { SafeUser, toSafeUser } from './user.model'

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })
}

export async function findUserById(id: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  })

  return user ? toSafeUser(user) : null
}

export async function listUsers(role?: Role): Promise<SafeUser[]> {
  const where = role ? { role } : undefined

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return users.map(toSafeUser)
}
