import { Role } from '@prisma/client'

import { env } from '../config/env'
import { prisma } from '../config/prisma'
import { hashPassword } from '../utils/password'

async function ensureAdmin() {
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD)

  const admin = await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {
      name: env.ADMIN_NAME,
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMIN,
    },
  })

  console.log(`Admin account ready: ${admin.email}`)
}

void ensureAdmin()
  .catch((error) => {
    console.error('Failed to ensure admin account', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
