import { FinancingStatus, InvoiceStatus, PoolTransactionType, Role } from '@prisma/client'

import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { getPoolInfo } from '../pool/pool.service'
import {
  buildContractRequestId,
  buildTransactionHash,
  getStellarMetadata,
} from '../stellar/stellar.service'
import { requireAdminPrimaryWallet, requirePrimaryWallet } from '../wallets/wallet.service'
import { calculateFinancingTerms, roundMoney } from './financing.utils'

function canAccessRequest(
  role: Role,
  userId: string,
  supplierId: string,
  requesterWalletAddress?: string | null,
  customerWalletAddress?: string | null,
) {
  if (role === Role.ADMIN || supplierId === userId) {
    return true
  }

  if (role === Role.INVESTOR) {
    return true
  }

  return role === Role.CUSTOMER && Boolean(requesterWalletAddress && requesterWalletAddress === customerWalletAddress)
}

async function findFinancingRequest(requestId: string) {
  const request = await prisma.financingRequest.findUnique({
    where: {
      id: requestId,
    },
    include: {
      invoice: true,
      settlement: true,
      platformFee: true,
      supplier: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!request) {
    throw new AppError('Financing request not found', 404)
  }

  return request
}

export async function createFinancingRequest(userId: string, role: Role, invoiceId: string) {
  if (role !== Role.BORROWER) {
    throw new AppError('Only suppliers can create financing requests', 403)
  }

  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    include: {
      financingRequest: true,
    },
  })

  if (!invoice) {
    throw new AppError('Invoice not found', 404)
  }

  if (invoice.supplierId !== userId) {
    throw new AppError('Suppliers can only finance their own invoices', 403)
  }

  if (invoice.status !== InvoiceStatus.VERIFIED) {
    throw new AppError('Only verified invoices can request financing', 400)
  }

  if (invoice.financingRequest) {
    throw new AppError('This invoice already has a financing request', 409)
  }

  const terms = calculateFinancingTerms(invoice.invoiceAmount)

  const request = await prisma.financingRequest.create({
    data: {
      invoiceId: invoice.id,
      supplierId: userId,
      ...terms,
    },
  })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        status: InvoiceStatus.FINANCING_REQUESTED,
      },
    })

    return tx.financingRequest.update({
      where: {
        id: request.id,
      },
      data: {
        contractRequestId: buildContractRequestId(request.id),
      },
      include: {
        invoice: true,
        settlement: true,
        platformFee: true,
      },
    })
  })

  return {
    request: updated,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('request_financing', updated.id),
    },
  }
}

export async function listFinancingRequests(
  userId: string,
  role: Role,
  status?: FinancingStatus,
) {
  const baseStatus =
    role === Role.INVESTOR || role === Role.CUSTOMER
      ? status ?? {
          in: [
            FinancingStatus.APPROVED,
            FinancingStatus.ACTIVE,
            FinancingStatus.SETTLED,
            FinancingStatus.REJECTED,
          ],
        }
      : status

  const where =
    role === Role.ADMIN
      ? { status: baseStatus }
      : role === Role.BORROWER
        ? { supplierId: userId, status: baseStatus }
        : role === Role.CUSTOMER
          ? {
              status: baseStatus,
              invoice: {
                customerWalletAddress: (await requirePrimaryWallet(userId)).walletAddress,
              },
            }
          : { status: baseStatus }

  return prisma.financingRequest.findMany({
    where,
    include: {
      invoice: true,
      settlement: true,
      platformFee: true,
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
  const request = await findFinancingRequest(requestId)
  const customerWallet =
    role === Role.CUSTOMER ? (await requirePrimaryWallet(userId)).walletAddress : null

  if (
    !canAccessRequest(
      role,
      userId,
      request.supplierId,
      customerWallet,
      request.invoice.customerWalletAddress,
    )
  ) {
    throw new AppError('Forbidden', 403)
  }

  return request
}

export async function approveFinancingRequest(
  requestId: string,
  adminId: string,
  role: Role,
  note?: string,
) {
  if (role !== Role.ADMIN) {
    throw new AppError('Only administrators can approve financing requests', 403)
  }

  await requireAdminPrimaryWallet(adminId)

  const request = await findFinancingRequest(requestId)

  if (request.status !== FinancingStatus.PENDING_APPROVAL) {
    throw new AppError('Only pending financing requests can be approved', 400)
  }

  const updated = await prisma.financingRequest.update({
    where: {
      id: requestId,
    },
    data: {
      status: FinancingStatus.APPROVED,
      approvedById: adminId,
      approvedAt: new Date(),
      transactionHash: buildTransactionHash('approve_financing', requestId),
    },
    include: {
      invoice: true,
      settlement: true,
      platformFee: true,
    },
  })

  return {
    request: {
      ...updated,
      approvalNote: note,
    },
    stellar: {
      ...getStellarMetadata(),
      transactionHash: updated.transactionHash,
    },
  }
}

export async function rejectFinancingRequest(
  requestId: string,
  adminId: string,
  role: Role,
  note?: string,
) {
  if (role !== Role.ADMIN) {
    throw new AppError('Only administrators can reject financing requests', 403)
  }

  await requireAdminPrimaryWallet(adminId)

  const request = await findFinancingRequest(requestId)
  if (request.status !== FinancingStatus.PENDING_APPROVAL) {
    throw new AppError('Only pending financing requests can be rejected', 400)
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: {
        id: request.invoiceId,
      },
      data: {
        status: InvoiceStatus.VERIFIED,
      },
    })

    return tx.financingRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: FinancingStatus.REJECTED,
        transactionHash: buildTransactionHash('reject_financing', requestId),
      },
      include: {
        invoice: true,
        settlement: true,
        platformFee: true,
      },
    })
  })

  return {
    request: {
      ...updated,
      rejectionNote: note,
    },
    stellar: {
      ...getStellarMetadata(),
      transactionHash: updated.transactionHash,
    },
  }
}

export async function borrowAgainstFinancing(
  requestId: string,
  userId: string,
  role: Role,
) {
  const request = await findFinancingRequest(requestId)

  if (role !== Role.BORROWER || request.supplierId !== userId) {
    throw new AppError('Only the supplier who created the request can borrow funds', 403)
  }

  if (request.invoice.status !== InvoiceStatus.FINANCING_REQUESTED) {
    throw new AppError('Invoice must be financing requested before borrowing', 400)
  }

  if (request.status !== FinancingStatus.APPROVED) {
    throw new AppError('Only approved financing requests can be funded', 400)
  }

  const poolInfo = await getPoolInfo()
  if (request.grossBorrowAmount > poolInfo.availableLiquidity) {
    throw new AppError('Insufficient pool liquidity to fund this financing request', 400)
  }

  const supplierWallet = await requirePrimaryWallet(userId)
  const transactionHash = buildTransactionHash('borrow', request.id)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.poolTransaction.create({
      data: {
        type: PoolTransactionType.BORROW,
        userId,
        walletAddress: supplierWallet.walletAddress,
        amount: request.grossBorrowAmount,
        transactionHash,
      },
    })

    await tx.invoice.update({
      where: {
        id: request.invoiceId,
      },
      data: {
        status: InvoiceStatus.FUNDED,
      },
    })

    return tx.financingRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: FinancingStatus.ACTIVE,
        borrowedAt: new Date(),
        transactionHash,
      },
      include: {
        invoice: true,
        settlement: true,
        platformFee: true,
      },
    })
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
