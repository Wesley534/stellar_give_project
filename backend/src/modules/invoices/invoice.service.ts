import { InvoiceStatus, Role } from '@prisma/client'

import { prisma } from '../../config/prisma'
import { AppError } from '../../middlewares/error.middleware'
import {
  buildContractInvoiceId,
  buildTransactionHash,
  getStellarMetadata,
} from '../stellar/stellar.service'
import { requirePrimaryWallet } from '../wallets/wallet.service'

type CreateInvoiceInput = {
  customerName: string
  customerWalletAddress?: string
  invoiceNumber: string
  invoiceAmount: number
  dueDate: string
}

function assertSupplier(role: Role) {
  if (role !== Role.BORROWER) {
    throw new AppError('Only suppliers can create invoices', 403)
  }
}

async function ensureInvoiceAccess(invoiceId: string, userId: string, role: Role) {
  const invoice = await prisma.invoice.findUnique({
    where: {
      id: invoiceId,
    },
    include: {
      financingRequest: true,
      settlement: true,
      supplier: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!invoice) {
    throw new AppError('Invoice not found', 404)
  }

  if (role === Role.ADMIN || invoice.supplierId === userId) {
    return invoice
  }

  const wallet = await requirePrimaryWallet(userId)
  if (invoice.customerWalletAddress && invoice.customerWalletAddress === wallet.walletAddress) {
    return invoice
  }

  throw new AppError('Forbidden', 403)
}

export async function createInvoice(userId: string, role: Role, input: CreateInvoiceInput) {
  assertSupplier(role)

  const dueDate = new Date(input.dueDate)
  if (Number.isNaN(dueDate.getTime())) {
    throw new AppError('Due date must be a valid ISO date', 400)
  }

  const invoice = await prisma.invoice.create({
    data: {
      supplierId: userId,
      customerName: input.customerName,
      customerWalletAddress: input.customerWalletAddress,
      invoiceNumber: input.invoiceNumber,
      invoiceAmount: input.invoiceAmount,
      dueDate,
    },
  })

  const updated = await prisma.invoice.update({
    where: {
      id: invoice.id,
    },
    data: {
      contractInvoiceId: buildContractInvoiceId(invoice.id),
    },
    include: {
      financingRequest: true,
      settlement: true,
    },
  })

  return {
    invoice: updated,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('create_invoice', updated.id),
    },
  }
}

export async function listInvoices(
  userId: string,
  role: Role,
  status?: InvoiceStatus,
) {
  let where: { supplierId?: string; customerWalletAddress?: string; status?: InvoiceStatus } = {}

  if (status) {
    where.status = status
  }

  if (role === Role.BORROWER) {
    where.supplierId = userId
  } else if (role === Role.CUSTOMER) {
    const wallet = await requirePrimaryWallet(userId)
    where.customerWalletAddress = wallet.walletAddress
  }

  return prisma.invoice.findMany({
    where,
    include: {
      financingRequest: true,
      settlement: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export function getInvoiceById(invoiceId: string, userId: string, role: Role) {
  return ensureInvoiceAccess(invoiceId, userId, role)
}

export async function verifyInvoice(invoiceId: string, userId: string, role: Role) {
  const invoice = await ensureInvoiceAccess(invoiceId, userId, role)

  if (invoice.status !== InvoiceStatus.PENDING_VERIFICATION) {
    throw new AppError('Only pending invoices can be verified', 400)
  }

  if (role !== Role.CUSTOMER) {
    throw new AppError('Only the assigned customer can verify this invoice', 403)
  }

  const wallet = await requirePrimaryWallet(userId)
  const customerWalletAddress = invoice.customerWalletAddress ?? wallet.walletAddress

  if (customerWalletAddress !== wallet.walletAddress) {
    throw new AppError('Only the assigned customer can verify this invoice', 403)
  }

  const updated = await prisma.invoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      status: InvoiceStatus.VERIFIED,
      customerWalletAddress,
    },
    include: {
      financingRequest: true,
      settlement: true,
    },
  })

  return {
    invoice: updated,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('verify_invoice', invoiceId),
    },
  }
}

export async function rejectInvoice(invoiceId: string, userId: string, role: Role) {
  const invoice = await ensureInvoiceAccess(invoiceId, userId, role)

  if (invoice.status === InvoiceStatus.FUNDED || invoice.status === InvoiceStatus.SETTLED) {
    throw new AppError('Funded or settled invoices cannot be rejected', 400)
  }

  if (role !== Role.ADMIN) {
    const wallet = await requirePrimaryWallet(userId)
    if (invoice.customerWalletAddress && invoice.customerWalletAddress !== wallet.walletAddress) {
      throw new AppError('Only the assigned customer can reject this invoice', 403)
    }
  }

  const updated = await prisma.invoice.update({
    where: {
      id: invoiceId,
    },
    data: {
      status: InvoiceStatus.REJECTED,
    },
    include: {
      financingRequest: true,
      settlement: true,
    },
  })

  return {
    invoice: updated,
    stellar: {
      ...getStellarMetadata(),
      transactionHash: buildTransactionHash('reject_invoice', invoiceId),
    },
  }
}
