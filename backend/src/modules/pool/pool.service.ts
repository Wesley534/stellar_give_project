import {
  PoolDepositSourceType,
  PoolTransactionType,
  Role,
  WalletNetwork,
} from '@prisma/client'

import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { FIAT_SIMULATION_KES_PER_XLM } from '../financing/financing.constants'
import { roundMoney } from '../financing/financing.utils'
import { buildTransactionHash, getStellarMetadata } from '../stellar/stellar.service'
import { requirePrimaryWallet } from '../wallets/wallet.service'

function assertInvestor(role: Role) {
  if (role !== Role.INVESTOR) {
    throw new AppError('Only investors can access pool operations', 403)
  }
}

async function getPoolLedger() {
  const [depositTotals, withdrawalTotals, activeFundingTotals, settledInterestTotals, feeTotals] =
    await Promise.all([
      prisma.poolDeposit.aggregate({
        _sum: {
          tokenAmount: true,
          sharesReceived: true,
        },
      }),
      prisma.poolTransaction.aggregate({
        where: {
          type: PoolTransactionType.WITHDRAWAL,
        },
        _sum: {
          amount: true,
          sharesAmount: true,
        },
      }),
      prisma.financingRequest.aggregate({
        where: {
          status: 'ACTIVE',
        },
        _sum: {
          grossBorrowAmount: true,
        },
      }),
      prisma.invoiceSettlement.aggregate({
        _sum: {
          interestRecovered: true,
        },
      }),
      prisma.platformFee.aggregate({
        _sum: {
          feeAmount: true,
        },
      }),
    ])

  const totalDepositedLiquidity = depositTotals._sum.tokenAmount ?? 0
  const totalDepositShares = depositTotals._sum.sharesReceived ?? 0
  const totalWithdrawnLiquidity = withdrawalTotals._sum.amount ?? 0
  const totalWithdrawnShares = withdrawalTotals._sum.sharesAmount ?? 0
  const outstandingPrincipal = activeFundingTotals._sum.grossBorrowAmount ?? 0
  const totalInterestEarned = settledInterestTotals._sum.interestRecovered ?? 0
  const totalPlatformFees = feeTotals._sum.feeAmount ?? 0
  const totalLiquidity = roundMoney(
    totalDepositedLiquidity - totalWithdrawnLiquidity + totalInterestEarned,
  )
  const availableLiquidity = roundMoney(totalLiquidity - outstandingPrincipal)
  const totalShares = roundMoney(totalDepositShares - totalWithdrawnShares)

  return {
    totalLiquidity,
    availableLiquidity,
    totalShares,
    outstandingPrincipal: roundMoney(outstandingPrincipal),
    totalInterestEarned: roundMoney(totalInterestEarned),
    totalPlatformFees: roundMoney(totalPlatformFees),
  }
}

export async function getPoolInfo() {
  const ledger = await getPoolLedger()
  const activeFinancingCount = await prisma.financingRequest.count({
    where: {
      status: 'ACTIVE',
    },
  })

  return {
    totalLiquidity: ledger.totalLiquidity,
    availableLiquidity: ledger.availableLiquidity,
    totalShares: ledger.totalShares,
    activeFinancingCount,
    outstandingPrincipal: ledger.outstandingPrincipal,
    totalInterestEarned: ledger.totalInterestEarned,
    totalPlatformFees: ledger.totalPlatformFees,
    sharePrice:
      ledger.totalShares > 0 ? roundMoney(ledger.totalLiquidity / ledger.totalShares) : 1,
    fiatSimulationRateKesPerXlm: FIAT_SIMULATION_KES_PER_XLM,
    stellar: getStellarMetadata(),
  }
}

export async function getInvestorPosition(userId: string, role: Role) {
  assertInvestor(role)

  const [poolInfo, depositTotals, withdrawalTotals] = await Promise.all([
    getPoolInfo(),
    prisma.poolDeposit.aggregate({
      where: {
        investorId: userId,
      },
      _sum: {
        tokenAmount: true,
        sharesReceived: true,
      },
    }),
    prisma.poolTransaction.aggregate({
      where: {
        userId,
        type: PoolTransactionType.WITHDRAWAL,
      },
      _sum: {
        amount: true,
        sharesAmount: true,
      },
    }),
  ])

  const sharesOwned = roundMoney(
    (depositTotals._sum.sharesReceived ?? 0) - (withdrawalTotals._sum.sharesAmount ?? 0),
  )
  const depositedAmount = roundMoney(
    (depositTotals._sum.tokenAmount ?? 0) - (withdrawalTotals._sum.amount ?? 0),
  )
  const currentValue =
    poolInfo.totalShares > 0
      ? roundMoney((sharesOwned / poolInfo.totalShares) * poolInfo.totalLiquidity)
      : 0

  return {
    sharesOwned,
    currentValue,
    depositedAmount,
    earnedInterest: roundMoney(currentValue - depositedAmount),
    poolSharePercentage:
      poolInfo.totalShares > 0 ? roundMoney((sharesOwned / poolInfo.totalShares) * 100) : 0,
  }
}

function validateTestnetDeposit(transactionHash: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(transactionHash)) {
    throw new AppError('Transaction hash must be a valid 64-character Stellar hash', 400)
  }
}

async function createPoolDepositRecord(input: {
  userId: string
  walletAddress: string
  sourceType: PoolDepositSourceType
  sourceAmount: number
  tokenAmount: number
  transactionHash?: string
}) {
  const poolInfo = await getPoolInfo()
  const sharesReceived =
    poolInfo.totalShares <= 0 || poolInfo.totalLiquidity <= 0
      ? input.tokenAmount
      : roundMoney((input.tokenAmount * poolInfo.totalShares) / poolInfo.totalLiquidity)

  const deposit = await prisma.poolDeposit.create({
    data: {
      investorId: input.userId,
      walletAddress: input.walletAddress,
      sourceType: input.sourceType,
      sourceAmount: input.sourceAmount,
      tokenAmount: input.tokenAmount,
      sharesReceived,
      transactionHash: input.transactionHash,
    },
  })

  await prisma.poolTransaction.create({
    data: {
      type:
        input.sourceType === PoolDepositSourceType.XLM
          ? PoolTransactionType.XLM_DEPOSIT
          : PoolTransactionType.FIAT_SIMULATION,
      userId: input.userId,
      walletAddress: input.walletAddress,
      amount: input.tokenAmount,
      sharesAmount: sharesReceived,
      transactionHash: input.transactionHash,
    },
  })

  return {
    deposit,
    pool: await getPoolInfo(),
    stellar: getStellarMetadata(),
  }
}

export async function recordXlmDeposit(
  userId: string,
  role: Role,
  sourceAmount: number,
  transactionHash: string,
) {
  assertInvestor(role)
  validateTestnetDeposit(transactionHash)

  const wallet = await requirePrimaryWallet(userId)

  if (wallet.network !== WalletNetwork.TESTNET) {
    throw new AppError('Real XLM deposits must come from a Stellar Testnet wallet', 400)
  }

  return createPoolDepositRecord({
    userId,
    walletAddress: wallet.walletAddress,
    sourceType: PoolDepositSourceType.XLM,
    sourceAmount: roundMoney(sourceAmount),
    tokenAmount: roundMoney(sourceAmount),
    transactionHash,
  })
}

export async function simulateFiatDeposit(
  userId: string,
  role: Role,
  kesAmount: number,
) {
  assertInvestor(role)

  const wallet = await requirePrimaryWallet(userId)
  const tokenAmount = roundMoney(kesAmount / FIAT_SIMULATION_KES_PER_XLM)

  if (tokenAmount <= 0) {
    throw new AppError('Simulated token amount must be positive', 400)
  }

  return createPoolDepositRecord({
    userId,
    walletAddress: wallet.walletAddress,
    sourceType: PoolDepositSourceType.FIAT_SIMULATION,
    sourceAmount: roundMoney(kesAmount),
    tokenAmount,
    transactionHash: buildTransactionHash('simulate_fiat_deposit', userId),
  })
}

export async function withdrawFromPool(
  userId: string,
  role: Role,
  shareAmount: number,
) {
  assertInvestor(role)

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

  const withdrawAmount = roundMoney((shareAmount * poolInfo.totalLiquidity) / poolInfo.totalShares)

  if (withdrawAmount > poolInfo.availableLiquidity) {
    throw new AppError('Insufficient available liquidity for this withdrawal', 400)
  }

  const transactionHash = buildTransactionHash('withdraw_liquidity', userId)
  const withdrawal = await prisma.poolTransaction.create({
    data: {
      type: PoolTransactionType.WITHDRAWAL,
      userId,
      walletAddress: wallet.walletAddress,
      amount: withdrawAmount,
      sharesAmount: roundMoney(shareAmount),
      transactionHash,
    },
  })

  return {
    withdrawal: {
      ...withdrawal,
      sharesRedeemed: roundMoney(shareAmount),
    },
    pool: await getPoolInfo(),
    stellar: {
      ...getStellarMetadata(),
      transactionHash,
    },
  }
}
