import { prisma } from '../../config/prisma'

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

export async function listUsers(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return users.map(toSafeUser)
}
