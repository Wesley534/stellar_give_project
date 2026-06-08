import { FinancingStatus, InvoiceStatus, PoolTransactionType, Role } from '@prisma/client'

import { env } from '../../config/env'
import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import {
  buildCustomerTreasuryRepaymentInvocation,
  submitTreasurySupplierPayout,
} from '../contract/contract.service'
import { getPoolInfo } from '../pool/pool.service'
import {
  getStellarMetadata,
} from '../stellar/stellar.service'
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
  transactionHash: string,
) {
  console.log('[settlements] payInvoiceSettlement:start', {
    requestId,
    userId,
    role,
    transactionHash,
  })
  const request = await findRequest(requestId)
  console.log('[settlements] payInvoiceSettlement:request-loaded', {
    requestId,
    requestStatus: request.status,
    invoiceStatus: request.invoice.status,
    supplierId: request.supplierId,
    customerId: request.invoice.customerId,
    invoiceAmount: request.invoice.invoiceAmount,
  })

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

  if (role !== Role.CUSTOMER) {
    throw new AppError('Only the assigned customer can settle this invoice', 403)
  }

  if (request.invoice.customerId !== userId) {
    throw new AppError('Only the assigned customer can settle this invoice', 403)
  }

  const principalRecovered = request.grossBorrowAmount
  const interestRecovered = request.interestAmount
  const processingFeeRecovered = request.processingFeeAmount
  const supplierSurplus =
    request.invoice.invoiceAmount -
    principalRecovered -
    interestRecovered -
    processingFeeRecovered

  console.log('[settlements] payInvoiceSettlement:breakdown', {
    requestId,
    principalRecovered,
    interestRecovered,
    processingFeeRecovered,
    supplierSurplus,
  })

  if (supplierSurplus < 0) {
    throw new AppError('Invoice amount is insufficient to settle this financing request', 400)
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const createdSettlement = await tx.invoiceSettlement.create({
      data: {
        financingRequestId: request.id,
        invoiceId: request.invoiceId,
        customerId: userId,
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
          userId,
          walletAddress: wallet.walletAddress,
          amount: principalRecovered + interestRecovered,
          transactionHash,
        },
        {
          type: PoolTransactionType.PROCESSING_FEE,
          userId,
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
        customerWalletAddress: wallet.walletAddress,
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

  console.log('[settlements] payInvoiceSettlement:db-settlement-recorded', {
    requestId,
    settlementId: settlement.id,
  })

  const supplierWallet = await requirePrimaryWallet(request.supplierId)
  console.log('[settlements] payInvoiceSettlement:supplier-wallet', {
    requestId,
    supplierId: request.supplierId,
    supplierWalletAddress: supplierWallet.walletAddress,
  })
  const supplierPayout =
    supplierSurplus > 0
      ? await submitTreasurySupplierPayout(supplierWallet.walletAddress, supplierSurplus)
      : null

  console.log('[settlements] payInvoiceSettlement:completed', {
    requestId,
    settlementId: settlement.id,
    supplierPayout,
  })

  return {
    settlement,
    supplierPayout,
    pool: await getPoolInfo(),
    stellar: {
      ...getStellarMetadata(),
      transactionHash,
    },
  }
}

export async function prepareSettlementPayment(
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

  if (role !== Role.CUSTOMER) {
    throw new AppError('Only the assigned customer can settle this invoice', 403)
  }

  if (request.invoice.customerId !== userId) {
    throw new AppError('Only the assigned customer can settle this invoice', 403)
  }

  await requirePrimaryWallet(userId)

  return buildCustomerTreasuryRepaymentInvocation(userId, role, request.invoice.invoiceAmount)
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
