import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { buildTransactionHash, getStellarMetadata } from '../stellar/stellar.service'

export async function connectWallet(
  userId: string,
  walletAddress: string,
  network: 'TESTNET' | 'MAINNET',
) {
  await prisma.wallet.updateMany({
    where: { userId },
    data: { isPrimary: false },
  })

  const wallet = await prisma.wallet.upsert({
    where: {
      userId_walletAddress: {
        userId,
        walletAddress,
      },
    },
    update: {
      network,
      isPrimary: true,
    },
    create: {
      userId,
      walletAddress,
      network,
      isPrimary: true,
    },
  })

  return {
    wallet,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('connect_wallet', wallet.id),
    },
  }
}

export async function listUserWallets(userId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  })

  return {
    wallets,
    primaryWallet: wallets.find((wallet) => wallet.isPrimary) ?? null,
  }
}

export async function requirePrimaryWallet(userId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: {
      userId,
      isPrimary: true,
    },
  })

  if (!wallet) {
    throw new AppError('Connect a primary wallet before using this endpoint', 400)
  }

  return wallet
}
