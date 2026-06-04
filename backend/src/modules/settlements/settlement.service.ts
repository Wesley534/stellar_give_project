import { FinancingStatus, InvoiceStatus, PoolTransactionType, Role } from '@prisma/client'

import { env } from '../../config/env'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import { getPoolInfo } from '../pool/pool.service'
import { buildTransactionHash, getStellarMetadata } from '../stellar/stellar.service'
import { requirePrimaryWallet } from '../wallets/wallet.service'

async function findRequest(requestId: string) {
  const request = await prisma.financingRequest.findUnique({
    where: {
      id: requestId,
    },
    include: {
      invoice: true,
      settlement: true,
      platformFee: true,
    },
  })

  if (!request) {
    throw new AppError('Financing request not found', 404)
  }

  return request
}

export async function payInvoiceSettlement(
  requestId: string,
  userId: string,
  role: Role,
) {
  const request = await findRequest(requestId)

  if (request.status !== FinancingStatus.ACTIVE) {
    throw new AppError('Only active financing requests can be settled', 400)
  }

  if (request.invoice.status !== InvoiceStatus.FUNDED) {
    throw new AppError('Only funded invoices can be settled', 400)
  }

  if (request.settlement) {
    throw new AppError('This invoice has already been settled', 409)
  }

  const wallet = await requirePrimaryWallet(userId)

  if (role !== Role.ADMIN) {
    if (!request.invoice.customerWalletAddress) {
      throw new AppError('Invoice does not have an assigned customer wallet', 400)
    }

    if (wallet.walletAddress !== request.invoice.customerWalletAddress) {
      throw new AppError('Only the assigned customer can settle this invoice', 403)
    }
  }

  const principalRecovered = request.grossBorrowAmount
  const interestRecovered = request.interestAmount
  const processingFeeRecovered = request.processingFeeAmount
  const supplierSurplus =
    request.invoice.invoiceAmount -
    principalRecovered -
    interestRecovered -
    processingFeeRecovered

  if (supplierSurplus < 0) {
    throw new AppError('Invoice amount is insufficient to settle this financing request', 400)
  }

  const transactionHash = buildTransactionHash('settle_invoice', request.id)

  const settlement = await prisma.$transaction(async (tx) => {
    const createdSettlement = await tx.invoiceSettlement.create({
      data: {
        financingRequestId: request.id,
        invoiceId: request.invoiceId,
        customerId: role === Role.ADMIN ? null : userId,
        customerWalletAddress: wallet.walletAddress,
        invoiceAmount: request.invoice.invoiceAmount,
        principalRecovered,
        interestRecovered,
        processingFeeRecovered,
        supplierSurplus,
        transactionHash,
      },
    })

    await tx.platformFee.create({
      data: {
        financingRequestId: request.id,
        feeAmount: processingFeeRecovered,
        treasuryWalletAddress: env.STELLAR_TREASURY_WALLET,
        transactionHash,
      },
    })

    await tx.poolTransaction.createMany({
      data: [
        {
          type: PoolTransactionType.SETTLEMENT,
          userId: role === Role.ADMIN ? null : userId,
          walletAddress: wallet.walletAddress,
          amount: principalRecovered + interestRecovered,
          transactionHash,
        },
        {
          type: PoolTransactionType.PROCESSING_FEE,
          userId: role === Role.ADMIN ? null : userId,
          walletAddress: env.STELLAR_TREASURY_WALLET,
          amount: processingFeeRecovered,
          transactionHash,
        },
      ],
    })

    await tx.invoice.update({
      where: {
        id: request.invoiceId,
      },
      data: {
        status: InvoiceStatus.SETTLED,
        customerWalletAddress: request.invoice.customerWalletAddress ?? wallet.walletAddress,
      },
    })

    await tx.financingRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: FinancingStatus.SETTLED,
        settledAt: new Date(),
        transactionHash,
      },
    })

    return createdSettlement
  })

  return {
    settlement,
    pool: await getPoolInfo(),
    stellar: {
      ...getStellarMetadata(),
      transactionHash,
    },
  }
}

export async function getSettlementByRequestId(
  requestId: string,
  userId: string,
  role: Role,
) {
  const request = await findRequest(requestId)

  if (!request.settlement) {
    throw new AppError('Settlement not found', 404)
  }

  if (
    role !== Role.ADMIN &&
    role !== Role.INVESTOR &&
    request.supplierId !== userId &&
    request.settlement.customerId !== userId
  ) {
    throw new AppError('Forbidden', 403)
  }

  return {
    settlement: request.settlement,
    platformFee: request.platformFee,
    invoice: request.invoice,
    request,
  }
}
