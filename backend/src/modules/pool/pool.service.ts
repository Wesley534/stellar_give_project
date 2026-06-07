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
import {
  getContractInvestorPosition,
  getContractPoolInfo,
} from '../contract/contract.service'
import { buildTransactionHash, getStellarMetadata } from '../stellar/stellar.service'
import { getPrimaryWallet, requirePrimaryWallet } from '../wallets/wallet.service'

function assertInvestor(role: Role) {
  if (role !== Role.INVESTOR) {
    throw new AppError('Only investors can access pool operations', 403)
  }
}

function parseOnChainI128(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
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
  const [activeFinancingCount, onChain] = await Promise.all([
    prisma.financingRequest.count({
      where: {
        status: 'ACTIVE',
      },
    }),
    getContractPoolInfo().catch((error) => ({
      unavailable: true,
      message: error instanceof Error ? error.message : 'Unable to read contract pool info',
    })),
  ])

  const onChainOutput =
    onChain &&
    typeof onChain === 'object' &&
    'output' in onChain &&
    onChain.output &&
    typeof onChain.output === 'object'
      ? onChain.output
      : null

  const totalLiquidity = parseOnChainI128(onChainOutput?.total_liquidity) ?? ledger.totalLiquidity
  const availableLiquidity =
    parseOnChainI128(onChainOutput?.available_liquidity) ?? ledger.availableLiquidity
  const totalShares = parseOnChainI128(onChainOutput?.total_shares) ?? ledger.totalShares
  const outstandingPrincipal =
    parseOnChainI128(onChainOutput?.total_outstanding_principal) ??
    ledger.outstandingPrincipal
  const totalInterestEarned =
    parseOnChainI128(onChainOutput?.total_interest_earned) ?? ledger.totalInterestEarned
  const totalPlatformFees =
    parseOnChainI128(onChainOutput?.total_platform_fees) ?? ledger.totalPlatformFees

  return {
    totalLiquidity,
    availableLiquidity,
    totalShares,
    activeFinancingCount,
    outstandingPrincipal,
    totalInterestEarned,
    totalPlatformFees,
    sharePrice:
      totalShares > 0 ? roundMoney(totalLiquidity / totalShares) : 1,
    fiatSimulationRateKesPerXlm: FIAT_SIMULATION_KES_PER_XLM,
    stellar: getStellarMetadata(),
    onChain,
  }
}

export async function getInvestorPosition(userId: string, role: Role) {
  assertInvestor(role)

  const wallet = await getPrimaryWallet(userId)

  const [poolInfo, depositTotals, withdrawalTotals, onChain] = await Promise.all([
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
    wallet
      ? getContractInvestorPosition(userId, role).catch((error) => ({
          unavailable: true,
          message:
            error instanceof Error ? error.message : 'Unable to read contract investor position',
        }))
      : Promise.resolve({
          unavailable: true,
          message: 'Connect a primary wallet to load the on-chain investor position',
        }),
  ])

  const onChainOutput =
    onChain &&
    typeof onChain === 'object' &&
    'output' in onChain &&
    onChain.output &&
    typeof onChain.output === 'object'
      ? onChain.output
      : null

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

  const onChainShares = parseOnChainI128(onChainOutput?.investor_shares)
  const onChainCurrentValue = parseOnChainI128(onChainOutput?.estimated_withdrawable_amount)
  const onChainPoolShareBps = parseOnChainI128(onChainOutput?.pool_share_bps)

  return {
    sharesOwned: onChainShares ?? sharesOwned,
    currentValue: onChainCurrentValue ?? currentValue,
    depositedAmount,
    earnedInterest: roundMoney((onChainCurrentValue ?? currentValue) - depositedAmount),
    poolSharePercentage:
      onChainPoolShareBps !== null
        ? roundMoney(onChainPoolShareBps / 100)
        : poolInfo.totalShares > 0
          ? roundMoney((sharesOwned / poolInfo.totalShares) * 100)
          : 0,
    onChain,
  }
}

export async function getInvestorEarnings(userId: string, role: Role) {
  assertInvestor(role)

  const [wallet, position] = await Promise.all([getPrimaryWallet(userId), getInvestorPosition(userId, role)])

  const yieldPercentage =
    position.depositedAmount > 0
      ? roundMoney((position.earnedInterest / position.depositedAmount) * 100)
      : 0

  return {
    walletAddress: wallet?.walletAddress ?? '',
    depositedAmount: position.depositedAmount,
    currentValue: position.currentValue,
    earnedInterest: position.earnedInterest,
    estimatedWithdrawableAmount: position.currentValue,
    sharesOwned: position.sharesOwned,
    poolSharePercentage: position.poolSharePercentage,
    yieldPercentage,
    onChain: position.onChain,
  }
}

export async function listInvestorDeposits(userId: string, role: Role) {
  assertInvestor(role)

  const [wallet, deposits] = await Promise.all([
    getPrimaryWallet(userId),
    prisma.poolDeposit.findMany({
      where: {
        investorId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
  ])

  const totalSourceAmount = roundMoney(
    deposits.reduce((sum, deposit) => sum + deposit.sourceAmount, 0),
  )
  const totalTokenAmount = roundMoney(
    deposits.reduce((sum, deposit) => sum + deposit.tokenAmount, 0),
  )
  const totalSharesReceived = roundMoney(
    deposits.reduce((sum, deposit) => sum + deposit.sharesReceived, 0),
  )

  return {
    walletAddress: wallet?.walletAddress ?? '',
    totals: {
      totalSourceAmount,
      totalTokenAmount,
      totalSharesReceived,
      depositCount: deposits.length,
    },
    deposits,
  }
}

export async function listInvestorActivity(userId: string, role: Role) {
  assertInvestor(role)

  const [wallet, deposits, withdrawals] = await Promise.all([
    getPrimaryWallet(userId),
    prisma.poolDeposit.findMany({
      where: {
        investorId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.poolTransaction.findMany({
      where: {
        userId,
        type: PoolTransactionType.WITHDRAWAL,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
  ])

  const activity = [
    ...deposits.map((deposit) => ({
      id: deposit.id,
      type: 'DEPOSIT' as const,
      sourceType: deposit.sourceType,
      walletAddress: deposit.walletAddress,
      sourceAmount: deposit.sourceAmount,
      tokenAmount: deposit.tokenAmount,
      sharesAmount: deposit.sharesReceived,
      transactionHash: deposit.transactionHash,
      createdAt: deposit.createdAt,
    })),
    ...withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      type: 'WITHDRAWAL' as const,
      sourceType: null,
      walletAddress: withdrawal.walletAddress,
      sourceAmount: withdrawal.amount,
      tokenAmount: withdrawal.amount,
      sharesAmount: withdrawal.sharesAmount ?? 0,
      transactionHash: withdrawal.transactionHash,
      createdAt: withdrawal.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return {
    walletAddress: wallet?.walletAddress ?? '',
    activity,
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

export async function recordContractTokenDeposit(
  userId: string,
  role: Role,
  tokenAmount: number,
  transactionHash: string,
) {
  assertInvestor(role)
  validateTestnetDeposit(transactionHash)

  const wallet = await requirePrimaryWallet(userId)
  const normalizedAmount = roundMoney(tokenAmount)

  if (normalizedAmount <= 0) {
    throw new AppError('Deposit amount must be positive', 400)
  }

  return createPoolDepositRecord({
    userId,
    walletAddress: wallet.walletAddress,
    sourceType: PoolDepositSourceType.XLM,
    sourceAmount: normalizedAmount,
    tokenAmount: normalizedAmount,
    transactionHash,
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
