import { FinancingStatus, Role } from '@prisma/client'

import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { getPoolInfo } from '../pool/pool.service'
import {
  buildContractRequestId,
  buildTransactionHash,
  getStellarMetadata,
} from '../stellar/stellar.service'
import { requirePrimaryWallet } from '../wallets/wallet.service'

type CreateFinancingInput = {
  invoiceNumber: string
  invoiceAmount: number
  borrowAmount: number
  repaymentAmount: number
  dueDate: string
  description?: string
}

type ReviewAction = 'APPROVE' | 'REJECT'

function canAccessRequest(role: Role, userId: string, borrowerId: string, status: FinancingStatus) {
  if (role === Role.ADMIN) {
    return true
  }

  if (role === Role.BORROWER) {
    return userId === borrowerId
  }

  if (role === Role.INVESTOR) {
    return status !== FinancingStatus.PENDING_ADMIN_REVIEW
  }

  return false
}

export async function createFinancingRequest(
  userId: string,
  role: Role,
  input: CreateFinancingInput,
) {
  if (role !== Role.BORROWER) {
    throw new AppError('Only borrowers can create financing requests', 403)
  }

  if (input.borrowAmount > input.invoiceAmount) {
    throw new AppError('Borrow amount cannot exceed the invoice amount', 400)
  }

  if (input.repaymentAmount <= input.borrowAmount) {
    throw new AppError('Repayment amount must be greater than the borrow amount', 400)
  }

  const dueDate = new Date(input.dueDate)

  if (Number.isNaN(dueDate.getTime())) {
    throw new AppError('Due date must be a valid ISO date', 400)
  }

  const wallet = await requirePrimaryWallet(userId)

  const request = await prisma.financingRequest.create({
    data: {
      borrowerId: userId,
      walletAddress: wallet.walletAddress,
      invoiceNumber: input.invoiceNumber,
      invoiceAmount: input.invoiceAmount,
      borrowAmount: input.borrowAmount,
      repaymentAmount: input.repaymentAmount,
      dueDate,
      description: input.description,
    },
  })

  const updated = await prisma.financingRequest.update({
    where: { id: request.id },
    data: {
      contractRequestId: buildContractRequestId(request.id),
    },
    include: {
      repayments: true,
    },
  })

  return {
    request: updated,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('create_financing_request', updated.id),
    },
  }
}

export async function listFinancingRequests(
  userId: string,
  role: Role,
  status?: FinancingStatus,
) {
  const where =
    role === Role.ADMIN
      ? { status }
      : role === Role.BORROWER
        ? { borrowerId: userId, status }
        : {
            status: status ?? {
              in: [
                FinancingStatus.APPROVED,
                FinancingStatus.BORROWED,
                FinancingStatus.REPAID,
                FinancingStatus.CLOSED,
                FinancingStatus.REJECTED,
              ],
            },
          }

  return prisma.financingRequest.findMany({
    where,
    include: {
      repayments: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function getFinancingRequestById(
  requestId: string,
  userId: string,
  role: Role,
) {
  const request = await prisma.financingRequest.findUnique({
    where: { id: requestId },
    include: {
      repayments: true,
    },
  })

  if (!request) {
    throw new AppError('Financing request not found', 404)
  }

  if (!canAccessRequest(role, userId, request.borrowerId, request.status)) {
    throw new AppError('Forbidden', 403)
  }

  return request
}

export async function reviewFinancingRequest(
  requestId: string,
  adminId: string,
  role: Role,
  action: ReviewAction,
  note?: string,
) {
  if (role !== Role.ADMIN) {
    throw new AppError('Only administrators can review financing requests', 403)
  }

  const request = await prisma.financingRequest.findUnique({
    where: { id: requestId },
    include: {
      repayments: true,
    },
  })

  if (!request) {
    throw new AppError('Financing request not found', 404)
  }

  if (request.status !== FinancingStatus.PENDING_ADMIN_REVIEW) {
    throw new AppError('Only pending financing requests can be reviewed', 400)
  }

  const status =
    action === 'APPROVE'
      ? FinancingStatus.APPROVED
      : FinancingStatus.REJECTED

  const updated = await prisma.financingRequest.update({
    where: { id: requestId },
    data: {
      status,
      approvalNote: note,
      approvedById: adminId,
      approvedAt: new Date(),
    },
    include: {
      repayments: true,
    },
  })

  return {
    request: updated,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('approve_request', updated.id),
    },
  }
}

export async function borrowAgainstFinancing(
  requestId: string,
  userId: string,
  role: Role,
) {
  const request = await getFinancingRequestById(requestId, userId, role)

  if (role !== Role.BORROWER || request.borrowerId !== userId) {
    throw new AppError('Only the borrower who created the request can borrow funds', 403)
  }

  if (request.status !== FinancingStatus.APPROVED) {
    throw new AppError('Only approved financing requests can be borrowed', 400)
  }

  const poolInfo = await getPoolInfo()

  if (request.borrowAmount > poolInfo.availableLiquidity) {
    throw new AppError('Insufficient pool liquidity to fund this financing request', 400)
  }

  const updated = await prisma.financingRequest.update({
    where: { id: requestId },
    data: {
      status: FinancingStatus.BORROWED,
      borrowedAt: new Date(),
    },
    include: {
      repayments: true,
    },
  })

  return {
    request: updated,
    pool: await getPoolInfo(),
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('borrow', updated.id),
    },
  }
}

export async function repayFinancing(
  requestId: string,
  userId: string,
  role: Role,
  amount: number,
) {
  const [request, wallet] = await Promise.all([
    getFinancingRequestById(requestId, userId, role),
    requirePrimaryWallet(userId),
  ])

  if (role !== Role.BORROWER || request.borrowerId !== userId) {
    throw new AppError('Only the borrower who created the request can repay it', 403)
  }

  if (request.status !== FinancingStatus.BORROWED) {
    throw new AppError('Only borrowed financing requests can be repaid', 400)
  }

  if (amount !== request.repaymentAmount) {
    throw new AppError(
      `Repayment amount must exactly match ${request.repaymentAmount}`,
      400,
    )
  }

  const transactionHash = buildTransactionHash('repay', request.id)

  await prisma.repayment.create({
    data: {
      financingRequestId: request.id,
      walletAddress: wallet.walletAddress,
      amount,
      transactionHash,
    },
  })

  const updated = await prisma.financingRequest.update({
    where: { id: request.id },
    data: {
      status: FinancingStatus.REPAID,
      repaidAt: new Date(),
    },
    include: {
      repayments: true,
    },
  })

  return {
    request: updated,
    pool: await getPoolInfo(),
    stellar: {
      ...getStellarMetadata(),
      transactionHash,
    },
  }
}
