import { execFile } from 'child_process'
import { promisify } from 'util'
import { Role } from '@prisma/client'

import { stellarConfig } from '../../config/stellar'
import { AppError } from '../../middlewares/error.middleware'
import { requireAdminPrimaryWallet, requirePrimaryWallet } from '../wallets/wallet.service'

const execFileAsync = promisify(execFile)

type ContractArgValue = string | number | boolean

type ContractCallResult = {
  function: string
  sourceAccount: string
  mode: 'read' | 'build'
  commandPreview: string[]
  output: unknown
}

function assertContractConfigured() {
  if (!stellarConfig.isContractConfigured) {
    throw new AppError(
      'Stellar contract access is not configured. Set the contract ID, token address, and read source account first.',
      503,
    )
  }
}

function parseCliOutput(stdout: string) {
  const trimmed = stdout.trim()

  if (!trimmed) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function appendRpcArgs(args: string[]) {
  args.push('--rpc-url', stellarConfig.rpcUrl)
  args.push('--network-passphrase', stellarConfig.networkPassphrase)
}

function appendContractArgs(args: string[], method: string, values: Record<string, ContractArgValue>) {
  args.push('--', method)

  for (const [key, value] of Object.entries(values)) {
    args.push(`--${key}`)
    args.push(String(value))
  }
}

async function runStellarCommand(args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(stellarConfig.cliPath, args, {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    })

    return {
      stdout,
      stderr,
    }
  } catch (error) {
    const details =
      error instanceof Error && 'stderr' in error && typeof error.stderr === 'string'
        ? error.stderr
        : error instanceof Error
          ? error.message
          : 'Unknown stellar CLI error'

    throw new AppError(`Stellar contract call failed: ${details}`, 502)
  }
}

async function readContract(method: string, values: Record<string, ContractArgValue> = {}) {
  assertContractConfigured()

  const args = [
    'contract',
    'invoke',
    '--id',
    stellarConfig.contractId,
    '--source-account',
    stellarConfig.readSourceAccount,
    '--send',
    'no',
  ]
  appendRpcArgs(args)
  appendContractArgs(args, method, values)

  const { stdout } = await runStellarCommand(args)

  return {
    function: method,
    sourceAccount: stellarConfig.readSourceAccount,
    mode: 'read' as const,
    commandPreview: [stellarConfig.cliPath, ...args],
    output: parseCliOutput(stdout),
  }
}

async function buildContractInvocation(
  sourceAccount: string,
  method: string,
  values: Record<string, ContractArgValue> = {},
): Promise<ContractCallResult> {
  assertContractConfigured()

  const args = [
    'contract',
    'invoke',
    '--id',
    stellarConfig.contractId,
    '--source-account',
    sourceAccount,
    '--build-only',
  ]
  appendRpcArgs(args)
  appendContractArgs(args, method, values)

  const { stdout } = await runStellarCommand(args)

  return {
    function: method,
    sourceAccount,
    mode: 'build',
    commandPreview: [stellarConfig.cliPath, ...args],
    output: parseCliOutput(stdout),
  }
}

function assertRole(role: Role, allowed: Role[], message: string) {
  if (!allowed.includes(role)) {
    throw new AppError(message, 403)
  }
}

export function getContractMetadata() {
  return {
    network: stellarConfig.network,
    rpcUrl: stellarConfig.rpcUrl,
    networkPassphrase: stellarConfig.networkPassphrase,
    contractId: stellarConfig.contractId,
    tokenAddress: stellarConfig.tokenAddress,
    readSourceAccount: stellarConfig.readSourceAccount,
    adminSourceAccount: stellarConfig.adminSourceAccount,
    configured: stellarConfig.isContractConfigured,
  }
}

export function getContractPoolInfo() {
  return readContract('get_pool_info')
}

export async function getContractInvestorPosition(userId: string, role: Role) {
  assertRole(role, [Role.INVESTOR], 'Only investors can read their contract position')

  const wallet = await requirePrimaryWallet(userId)
  return readContract('get_investor_position', {
    investor: wallet.walletAddress,
  })
}

export function getContractInvoice(invoiceId: number) {
  return readContract('get_invoice', { invoice_id: invoiceId })
}

export function getContractFinancingRequest(requestId: number) {
  return readContract('get_financing_request', { request_id: requestId })
}

export async function buildDepositInvocation(userId: string, role: Role, amount: number) {
  assertRole(role, [Role.INVESTOR], 'Only investors can deposit into the pool')

  const wallet = await requirePrimaryWallet(userId)
  return buildContractInvocation(wallet.walletAddress, 'deposit', {
    investor: wallet.walletAddress,
    amount: Math.trunc(amount),
  })
}

export async function buildWithdrawInvocation(
  userId: string,
  role: Role,
  shareAmount: number,
) {
  assertRole(role, [Role.INVESTOR], 'Only investors can withdraw from the pool')

  const wallet = await requirePrimaryWallet(userId)
  return buildContractInvocation(wallet.walletAddress, 'withdraw', {
    investor: wallet.walletAddress,
    share_amount: Math.trunc(shareAmount),
  })
}

export async function buildCreateInvoiceInvocation(
  userId: string,
  role: Role,
  input: {
    customer: string
    invoiceNumber: string
    invoiceAmount: number
    dueDate: number
  },
) {
  assertRole(role, [Role.BORROWER], 'Only borrowers can create contract invoices')

  const wallet = await requirePrimaryWallet(userId)
  return buildContractInvocation(wallet.walletAddress, 'create_invoice', {
    supplier: wallet.walletAddress,
    customer: input.customer,
    invoice_number: input.invoiceNumber,
    invoice_amount: Math.trunc(input.invoiceAmount),
    due_date: input.dueDate,
  })
}

export async function buildVerifyInvoiceInvocation(userId: string, role: Role, invoiceId: number) {
  assertRole(role, [Role.CUSTOMER], 'Only the assigned customer can verify invoices')

  const sourceAccount = (await requirePrimaryWallet(userId)).walletAddress

  return buildContractInvocation(sourceAccount, 'verify_invoice', {
    customer: sourceAccount,
    invoice_id: invoiceId,
  })
}

export async function buildRejectInvoiceInvocation(userId: string, role: Role, invoiceId: number) {
  assertRole(role, [Role.CUSTOMER, Role.ADMIN], 'Only the customer or admin can reject invoices')

  const sourceAccount =
    role === Role.ADMIN
      ? stellarConfig.adminSourceAccount ?? stellarConfig.readSourceAccount
      : (await requirePrimaryWallet(userId)).walletAddress

  return buildContractInvocation(sourceAccount, 'reject_invoice', {
    customer_or_admin: sourceAccount,
    invoice_id: invoiceId,
  })
}

export async function buildRequestFinancingInvocation(
  userId: string,
  role: Role,
  input: {
    invoiceId: number
    advanceRateBps: number
    interestRateBps: number
    processingFeeBps: number
  },
) {
  assertRole(role, [Role.BORROWER], 'Only borrowers can request financing')

  const wallet = await requirePrimaryWallet(userId)
  return buildContractInvocation(wallet.walletAddress, 'request_financing', {
    supplier: wallet.walletAddress,
    invoice_id: input.invoiceId,
    advance_rate_bps: input.advanceRateBps,
    interest_rate_bps: input.interestRateBps,
    processing_fee_bps: input.processingFeeBps,
  })
}

export async function buildApproveFinancingInvocation(
  userId: string,
  role: Role,
  requestId: number,
) {
  assertRole(role, [Role.ADMIN], 'Only administrators can approve financing on-chain')

  const wallet = await requireAdminPrimaryWallet(userId)
  const sourceAccount = stellarConfig.adminSourceAccount ?? wallet.walletAddress
  return buildContractInvocation(sourceAccount, 'approve_financing', {
    admin: sourceAccount,
    request_id: requestId,
  })
}

export async function buildRejectFinancingInvocation(
  userId: string,
  role: Role,
  requestId: number,
) {
  assertRole(role, [Role.ADMIN], 'Only administrators can reject financing on-chain')

  const wallet = await requireAdminPrimaryWallet(userId)
  const sourceAccount = stellarConfig.adminSourceAccount ?? wallet.walletAddress
  return buildContractInvocation(sourceAccount, 'reject_financing', {
    admin: sourceAccount,
    request_id: requestId,
  })
}

export async function buildBorrowInvocation(userId: string, role: Role, requestId: number) {
  assertRole(role, [Role.BORROWER], 'Only borrowers can borrow against financing')

  const wallet = await requirePrimaryWallet(userId)
  return buildContractInvocation(wallet.walletAddress, 'borrow', {
    supplier: wallet.walletAddress,
    request_id: requestId,
  })
}

export async function buildSettleInvoiceInvocation(
  userId: string,
  role: Role,
  requestId: number,
) {
  assertRole(role, [Role.CUSTOMER], 'Only the assigned customer can settle invoices')

  const sourceAccount = (await requirePrimaryWallet(userId)).walletAddress

  return buildContractInvocation(sourceAccount, 'settle_invoice', {
    customer: sourceAccount,
    request_id: requestId,
  })
}

export async function buildWithdrawPlatformFeesInvocation(
  userId: string,
  role: Role,
  amount: number,
) {
  assertRole(role, [Role.ADMIN], 'Only administrators can withdraw platform fees')

  const wallet = await requireAdminPrimaryWallet(userId)
  const sourceAccount = stellarConfig.adminSourceAccount ?? wallet.walletAddress
  return buildContractInvocation(sourceAccount, 'withdraw_platform_fees', {
    admin: sourceAccount,
    amount: Math.trunc(amount),
  })
}
