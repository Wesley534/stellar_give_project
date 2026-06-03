import { FinancingStatus, Role } from '@prisma/client'

import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { buildTransactionHash, getStellarMetadata } from '../stellar/stellar.service'
import { requirePrimaryWallet } from '../wallets/wallet.service'

async function getLedgerSums() {
  const [
    depositTotals,
    repaymentTotals,
    activeBorrowedTotals,
    totalBorrowedTotals,
    totalLoanCount,
  ] =
    await Promise.all([
      prisma.poolDeposit.aggregate({
        _sum: {
          amount: true,
          sharesReceived: true,
        },
      }),
      prisma.repayment.aggregate({
        _sum: {
          amount: true,
        },
      }),
      prisma.financingRequest.aggregate({
        where: {
          status: FinancingStatus.BORROWED,
        },
        _sum: {
          borrowAmount: true,
        },
      }),
      prisma.financingRequest.aggregate({
        where: {
          status: {
            in: [
              FinancingStatus.BORROWED,
              FinancingStatus.REPAID,
              FinancingStatus.CLOSED,
            ],
          },
        },
        _sum: {
          borrowAmount: true,
        },
      }),
      prisma.financingRequest.count({
        where: {
          status: {
            in: [
              FinancingStatus.BORROWED,
              FinancingStatus.REPAID,
              FinancingStatus.CLOSED,
            ],
          },
        },
      }),
    ])

  return {
    totalDeposits: depositTotals._sum.amount ?? 0,
    totalShares: depositTotals._sum.sharesReceived ?? 0,
    totalRepayments: repaymentTotals._sum.amount ?? 0,
    outstandingLoans: activeBorrowedTotals._sum.borrowAmount ?? 0,
    totalBorrowed: totalBorrowedTotals._sum.borrowAmount ?? 0,
    totalLoans: totalLoanCount,
  }
}

export async function getPoolInfo() {
  const ledger = await getLedgerSums()
  const availableLiquidity = Math.max(
    ledger.totalDeposits + ledger.totalRepayments - ledger.totalBorrowed,
    0,
  )
  const totalLiquidity = availableLiquidity + ledger.outstandingLoans
  const sharePrice = ledger.totalShares > 0 ? totalLiquidity / ledger.totalShares : 1

  return {
    totalLiquidity,
    availableLiquidity,
    totalShares: ledger.totalShares,
    totalLoans: ledger.totalLoans,
    outstandingLoans: ledger.outstandingLoans,
    sharePrice,
    stellar: getStellarMetadata(),
  }
}

export async function getInvestorPosition(userId: string, role: Role) {
  if (role !== Role.INVESTOR) {
    throw new AppError('Only investors can access pool positions', 403)
  }

  const [poolInfo, ledger] = await Promise.all([
    getPoolInfo(),
    prisma.poolDeposit.aggregate({
      where: {
        investorId: userId,
      },
      _sum: {
        amount: true,
        sharesReceived: true,
      },
    }),
  ])

  const sharesOwned = ledger._sum.sharesReceived ?? 0
  const netDeposits = ledger._sum.amount ?? 0
  const currentValue =
    poolInfo.totalShares > 0
      ? (sharesOwned / poolInfo.totalShares) * poolInfo.totalLiquidity
      : 0

  return {
    sharesOwned,
    currentValue,
    deposits: netDeposits,
    earnedInterest: currentValue - netDeposits,
    poolSharePercentage:
      poolInfo.totalShares > 0 ? (sharesOwned / poolInfo.totalShares) * 100 : 0,
  }
}

export async function depositToPool(userId: string, role: Role, amount: number) {
  if (role !== Role.INVESTOR) {
    throw new AppError('Only investors can deposit liquidity into the pool', 403)
  }

  const [wallet, poolInfo] = await Promise.all([
    requirePrimaryWallet(userId),
    getPoolInfo(),
  ])

  const sharesReceived =
    poolInfo.totalShares <= 0 || poolInfo.totalLiquidity <= 0
      ? amount
      : (amount * poolInfo.totalShares) / poolInfo.totalLiquidity

  const deposit = await prisma.poolDeposit.create({
    data: {
      investorId: userId,
      walletAddress: wallet.walletAddress,
      amount,
      sharesReceived,
      transactionHash: buildTransactionHash('deposit', userId),
    },
  })

  return {
    deposit,
    pool: await getPoolInfo(),
    stellar: getStellarMetadata(),
  }
}

export async function withdrawFromPool(
  userId: string,
  role: Role,
  shareAmount: number,
) {
  if (role !== Role.INVESTOR) {
    throw new AppError('Only investors can withdraw liquidity from the pool', 403)
  }

  const [wallet, poolInfo, investorPosition] = await Promise.all([
    requirePrimaryWallet(userId),
    getPoolInfo(),
    getInvestorPosition(userId, role),
  ])

  if (shareAmount > investorPosition.sharesOwned) {
    throw new AppError('Share amount exceeds the investor position', 400)
  }

  if (poolInfo.totalShares <= 0) {
    throw new AppError('The pool does not have any active shares', 400)
  }

  const withdrawAmount = (shareAmount / poolInfo.totalShares) * poolInfo.totalLiquidity

  if (withdrawAmount > poolInfo.availableLiquidity) {
    throw new AppError('Insufficient available liquidity for this withdrawal', 400)
  }

  const withdrawal = await prisma.poolDeposit.create({
    data: {
      investorId: userId,
      walletAddress: wallet.walletAddress,
      amount: -withdrawAmount,
      sharesReceived: -shareAmount,
      transactionHash: buildTransactionHash('withdraw', userId),
    },
  })

  return {
    withdrawal: {
      ...withdrawal,
      amount: Math.abs(withdrawal.amount),
      sharesRedeemed: shareAmount,
    },
    pool: await getPoolInfo(),
    stellar: getStellarMetadata(),
  }
}
