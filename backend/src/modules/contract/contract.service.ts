import { spawn } from 'child_process'
import { setTimeout as delay } from 'timers/promises'
import { Role } from '@prisma/client'

import { stellarConfig } from '../../config/stellar'
import { AppError } from '../../middlewares/error.middleware'
import { requireAdminPrimaryWallet, requirePrimaryWallet } from '../wallets/wallet.service'

type ContractArgValue = string | number | boolean

type ContractCallResult = {
  function: string
  sourceAccount: string
  mode: 'read' | 'build'
  commandPreview: string[]
  output: unknown
}

type SubmittedTransactionResult = {
  hash: string
  output: unknown
}

const TRANSACTION_FINALIZATION_TIMEOUT_MS = 60_000
const TRANSACTION_FINALIZATION_POLL_MS = 2_000

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

function extractTransactionHash(output: unknown): string | null {
  const visited = new Set<unknown>()

  const visit = (value: unknown): string | null => {
    if (typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value)) {
      return value
    }

    if (!value || typeof value !== 'object' || visited.has(value)) {
      return null
    }

    visited.add(value)

    if (Array.isArray(value)) {
      for (const item of value) {
        const hash = visit(item)
        if (hash) {
          return hash
        }
      }
      return null
    }

    const record = value as Record<string, unknown>

    for (const [key, nestedValue] of Object.entries(record)) {
      if (key.toLowerCase().includes('hash')) {
        const hash = visit(nestedValue)
        if (hash) {
          return hash
        }
      }
    }

    for (const nestedValue of Object.values(record)) {
      const hash = visit(nestedValue)
      if (hash) {
        return hash
      }
    }

    return null
  }

  return visit(output)
}

async function waitForTransactionResult(hash: string) {
  const startedAt = Date.now()
  let lastError: unknown = null

  console.log(`[contract] waitForTransactionResult: polling result for hash=${hash}`)

  while (Date.now() - startedAt < TRANSACTION_FINALIZATION_TIMEOUT_MS) {
    try {
      const result = await rpcRequest<{
        status?: string
        resultXdr?: string
        resultMetaXdr?: string
        errorResultXdr?: string
      }>('getTransaction', {
        hash,
      })

      const status = typeof result?.status === 'string' ? result.status : 'UNKNOWN'

      if (status === 'SUCCESS') {
        console.log(`[contract] waitForTransactionResult: success for hash=${hash}`)
        return result
      }

      if (status === 'FAILED') {
        throw new AppError(
          `Stellar transaction failed on-chain for hash ${hash}`,
          502,
        )
      }

      if (status !== 'NOT_FOUND') {
        console.log(
          `[contract] waitForTransactionResult: pending status=${status} for hash=${hash}`,
        )
      }
    } catch (error) {
      lastError = error
    }

    await delay(TRANSACTION_FINALIZATION_POLL_MS)
  }

  const details =
    lastError instanceof Error ? lastError.message : 'transaction result never became available'

  throw new AppError(`Timed out waiting for Stellar transaction confirmation: ${details}`, 502)
}

async function rpcRequest<T>(method: string, params: Record<string, unknown>) {
  const response = await fetch(stellarConfig.rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${method}-${Date.now()}`,
      method,
      params,
    }),
  })

  if (!response.ok) {
    throw new AppError(`Stellar RPC request failed with HTTP ${response.status}`, 502)
  }

  const payload = (await response.json()) as {
    result?: T
    error?: {
      code?: number
      message?: string
      data?: unknown
    }
  }

  if (payload.error) {
    const details =
      typeof payload.error.message === 'string'
        ? payload.error.message
        : 'Unknown Stellar RPC error'

    throw new AppError(`Stellar RPC ${method} failed: ${details}`, 502)
  }

  if (!('result' in payload)) {
    throw new AppError(`Stellar RPC ${method} returned no result`, 502)
  }

  return payload.result as T
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

async function runStellarCommand(
  args: string[],
  options?: { input?: string },
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(stellarConfig.cliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
    }, 30_000)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      clearTimeout(timeout)
      const details =
        error instanceof Error && 'message' in error
          ? error.message
          : 'Unknown stellar CLI error'
      reject(new AppError(`Stellar contract call failed: ${details}`, 502))
    })

    child.on('close', code => {
      clearTimeout(timeout)
      if (code !== 0) {
        const details = stderr || `Stellar CLI exited with code ${code}`
        reject(new AppError(`Stellar contract call failed: ${details}`, 502))
        return
      }

      resolve({ stdout, stderr })
    })

    if (options?.input) {
      child.stdin.write(options.input.trim(), 'utf8')
      child.stdin.write('\n', 'utf8')
    }

    child.stdin.end()
  })
}

function buildCommandPreview(command: string[], masked = false) {
  return masked ? [...command, '[secure]'] : command
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
  const builtXdr = stdout.trim()
  const simulatedXdr = await simulateSorobanTransaction(sourceAccount, builtXdr)

  return {
    function: method,
    sourceAccount,
    mode: 'build',
    commandPreview: [stellarConfig.cliPath, ...args],
    output: simulatedXdr,
  }
}

async function readTokenContract(method: string, values: Record<string, ContractArgValue> = {}) {
  assertContractConfigured()

  const args = [
    'contract',
    'invoke',
    '--id',
    stellarConfig.tokenAddress,
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

async function buildTokenInvocation(
  sourceAccount: string,
  method: string,
  values: Record<string, ContractArgValue> = {},
): Promise<ContractCallResult> {
  assertContractConfigured()

  const args = [
    'contract',
    'invoke',
    '--id',
    stellarConfig.tokenAddress,
    '--source-account',
    sourceAccount,
    '--build-only',
  ]
  appendRpcArgs(args)
  appendContractArgs(args, method, values)

  const { stdout } = await runStellarCommand(args)
  const builtXdr = stdout.trim()
  const simulatedXdr = await simulateSorobanTransaction(sourceAccount, builtXdr)

  return {
    function: method,
    sourceAccount,
    mode: 'build' as const,
    commandPreview: [stellarConfig.cliPath, ...args],
    output: simulatedXdr,
  }
}

async function buildClassicTransaction(
  sourceAccount: string,
  label: string,
  args: string[],
): Promise<ContractCallResult> {
  const txArgs = ['tx', 'new', ...args, '--source-account', sourceAccount, '--build-only']
  appendRpcArgs(txArgs)

  const { stdout } = await runStellarCommand(txArgs)

  return {
    function: label,
    sourceAccount,
    mode: 'build',
    commandPreview: [stellarConfig.cliPath, ...txArgs],
    output: parseCliOutput(stdout),
  }
}

function normalizePaymentAmount(amount: number) {
  const normalized = Number(amount.toFixed(7))
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new AppError('Payment amount must be positive', 400)
  }

  return normalized
}

export async function buildTreasuryDisbursementPaymentInvocation(
  userId: string,
  role: Role,
  destination: string,
  amount: number,
) {
  assertRole(role, [Role.ADMIN], 'Only administrators can disburse treasury funds')

  const wallet = await requireAdminPrimaryWallet(userId)
  const sourceAccount = stellarConfig.adminSourceAccount ?? wallet.walletAddress

  return buildClassicTransaction(sourceAccount, 'treasury_disbursement_payment', [
    'payment',
    '--destination',
    destination,
    '--amount',
    String(normalizePaymentAmount(amount)),
  ])
}

export async function buildCustomerTreasuryRepaymentInvocation(
  userId: string,
  role: Role,
  amount: number,
) {
  assertRole(role, [Role.CUSTOMER], 'Only customers can repay funded invoices')

  const wallet = await requirePrimaryWallet(userId)

  return buildClassicTransaction(wallet.walletAddress, 'customer_treasury_repayment', [
    'payment',
    '--destination',
    stellarConfig.adminSourceAccount ?? stellarConfig.readSourceAccount,
    '--amount',
    String(normalizePaymentAmount(amount)),
  ])
}

export async function submitTreasurySupplierPayout(
  destination: string,
  amount: number,
) {
  if (!stellarConfig.adminSourceAccount || !stellarConfig.adminSecretKey) {
    throw new AppError('Treasury payout is not configured on the backend', 503)
  }

  const normalizedAmount = normalizePaymentAmount(amount)
  console.log('[contract] submitTreasurySupplierPayout:start', {
    sourceAccount: stellarConfig.adminSourceAccount,
    destination,
    amount,
    normalizedAmount,
  })
  const args = [
    'tx',
    'new',
    'payment',
    '--source-account',
    stellarConfig.adminSourceAccount,
    '--sign-with-key',
    stellarConfig.adminSecretKey,
    '--destination',
    destination,
    '--amount',
    String(normalizedAmount),
  ]
  appendRpcArgs(args)

  const { stdout } = await runStellarCommand(args)
  const parsedOutput = parseCliOutput(stdout)
  const transactionHash = extractTransactionHash(parsedOutput)
  console.log('[contract] submitTreasurySupplierPayout:built', {
    destination,
    normalizedAmount,
    transactionHash,
    parsedOutput,
  })

  const confirmedOutput = transactionHash
    ? await waitForTransactionResult(transactionHash)
    : parsedOutput

  console.log('[contract] submitTreasurySupplierPayout:success', {
    destination,
    normalizedAmount,
    transactionHash,
    confirmedOutput,
  })

  return {
    hash: transactionHash,
    output: confirmedOutput,
  }
}

async function simulateSorobanTransaction(sourceAccount: string, txXdr: string) {
  if (!txXdr) {
    throw new AppError('Missing Soroban transaction XDR before simulation', 502)
  }

  const args = ['tx', 'simulate', txXdr, '--source-account', sourceAccount]
  appendRpcArgs(args)

  const { stdout } = await runStellarCommand(args)
  const simulatedXdr = stdout.trim()

  if (!simulatedXdr) {
    throw new AppError('Soroban transaction simulation returned an empty XDR', 502)
  }

  return simulatedXdr
}

async function getLatestLedgerSequence() {
  const args = ['ledger', 'latest', '--output', 'json']
  appendRpcArgs(args)
  const { stdout } = await runStellarCommand(args)
  const output = parseCliOutput(stdout)

  if (
    output &&
    typeof output === 'object' &&
    'sequence' in output &&
    typeof output.sequence === 'number'
  ) {
    return output.sequence
  }

  throw new AppError('Unable to determine the latest Stellar ledger sequence', 502)
}

async function decodeSignedTransaction(signedXdr: string) {
  const args = [
    'tx',
    'decode',
    signedXdr,
    '--input',
    'single-base64',
    '--output',
    'json',
  ]

  const { stdout } = await runStellarCommand(args)
  const decoded = parseCliOutput(stdout)

  if (!decoded) {
    throw new AppError('Unable to decode the signed Stellar transaction XDR', 502)
  }

  return decoded
}

async function hashSignedTransaction(signedXdr: string) {
  const args = ['tx', 'hash', signedXdr, '--network-passphrase', stellarConfig.networkPassphrase]
  const { stdout } = await runStellarCommand(args)
  const hash = stdout.trim()

  if (!hash) {
    throw new AppError('Unable to compute the signed transaction hash', 502)
  }

  return hash
}

async function submitSignedTransaction(signedXdr: string): Promise<SubmittedTransactionResult> {
  console.log(
    `[contract] submitSignedTransaction: validating signed XDR length=${signedXdr.length}`,
  )
  console.log('[contract] signed XDR metadata', {
    length: signedXdr.length,
    preview: signedXdr.slice(0, 64),
  })
  console.log('[contract] submitting signed XDR', {
    length: signedXdr.length,
    preview: signedXdr.slice(0, 64),
  })

  const decoded = await decodeSignedTransaction(signedXdr)

  console.log(
    '[contract] FULL DECODED XDR',
    JSON.stringify(decoded, null, 2),
  )

  const decodedRecord = decoded as Record<string, unknown>
  const innerTx =
    decodedRecord?.tx && typeof decodedRecord.tx === 'object' &&
    (decodedRecord.tx as Record<string, unknown>)?.tx &&
    typeof (decodedRecord.tx as Record<string, unknown>).tx === 'object'
      ? ((decodedRecord.tx as Record<string, unknown>).tx as Record<string, unknown>)
      : undefined

  console.log('[contract] decoded transaction details', {
    type: typeof decoded,
    keys:
      decoded && typeof decoded === 'object'
        ? Object.keys(decoded as Record<string, unknown>)
        : [],
    sourceAccount: innerTx?.source_account,
    operationCount: Array.isArray(innerTx?.operations)
      ? (innerTx.operations as unknown[]).length
      : undefined,
  })

  const hash = await hashSignedTransaction(signedXdr)
  console.log(`[contract] submitSignedTransaction: sending transaction hash=${hash}`)

  const submission = await rpcRequest<{
    hash?: string
    status?: string
    errorResultXdr?: string
    latestLedger?: number
  }>('sendTransaction', {
    transaction: signedXdr,
  })

  console.log('[contract] submitSignedTransaction: rpc submission response', submission)

  if (submission.status === 'ERROR') {
    throw new AppError(
      `Stellar transaction submission failed${submission.errorResultXdr ? `: ${submission.errorResultXdr}` : ''}`,
      502,
    )
  }

  const output = await waitForTransactionResult(hash)
  console.log(`[contract] submitSignedTransaction: confirmed transaction hash=${hash}`)

  return {
    hash,
    output,
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
    tokenTrustlineAsset: stellarConfig.tokenTrustlineAsset,
    tokenIssuerAccount: stellarConfig.tokenIssuerAccount,
    autoFundingConfigured: Boolean(
      stellarConfig.tokenTrustlineAsset &&
        stellarConfig.tokenIssuerAccount &&
        stellarConfig.tokenIssuerSecretKey,
    ),
    configured: stellarConfig.isContractConfigured,
  }
}

export function getContractPoolInfo() {
  return readContract('get_pool_info')
}

export function getTokenMetadata() {
  return Promise.all([
    readTokenContract('name'),
    readTokenContract('symbol'),
    readTokenContract('decimals'),
  ]).then(([name, symbol, decimals]) => ({
    name: name.output,
    symbol: symbol.output,
    decimals: decimals.output,
    tokenAddress: stellarConfig.tokenAddress,
    trustlineAsset: stellarConfig.tokenTrustlineAsset,
    issuerAccount: stellarConfig.tokenIssuerAccount,
    autoFundingConfigured: Boolean(
      stellarConfig.tokenTrustlineAsset &&
        stellarConfig.tokenIssuerAccount &&
        stellarConfig.tokenIssuerSecretKey,
    ),
  }))
}

async function readTokenBalance(address: string) {
  const response = await readTokenContract('balance', { id: address })
  if (typeof response.output === 'number') {
    return response.output
  }
  if (typeof response.output === 'string') {
    const parsed = Number(response.output)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  throw new AppError('Unable to parse token balance for this wallet', 502)
}

export async function getContractInvestorPosition(userId: string, role: Role) {
  assertRole(role, [Role.INVESTOR], 'Only investors can read their contract position')

  const wallet = await requirePrimaryWallet(userId)
  return readContract('get_investor_position', {
    investor: wallet.walletAddress,
  })
}

export function getContractInvoice(invoiceId: string) {
  return readContract('get_invoice', { invoice_id: invoiceId })
}

export function getContractFinancingRequest(requestId: string) {
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

export async function buildTokenApproveInvocation(
  userId: string,
  role: Role,
  amount: number,
) {
  assertRole(role, [Role.INVESTOR, Role.CUSTOMER], 'Only wallet holders can approve token spending')

  const wallet = await requirePrimaryWallet(userId)
  const expirationLedger = (await getLatestLedgerSequence()) + 20_000

  return buildTokenInvocation(wallet.walletAddress, 'approve', {
    from: wallet.walletAddress,
    spender: stellarConfig.contractId,
    amount: Math.trunc(amount),
    expiration_ledger: expirationLedger,
  })
}

export async function buildInvestorTrustlineInvocation(userId: string, role: Role) {
  assertRole(role, [Role.INVESTOR], 'Only investors can set up token trustlines')

  if (!stellarConfig.tokenTrustlineAsset) {
    throw new AppError(
      'Token trustline asset is not configured on the backend. Set STELLAR_TOKEN_TRUSTLINE_ASSET first.',
      503,
    )
  }

  const wallet = await requirePrimaryWallet(userId)
  return buildClassicTransaction(wallet.walletAddress, 'change_trust', [
    'change-trust',
    '--line',
    stellarConfig.tokenTrustlineAsset,
  ])
}

export async function prepareInvestorDepositFlow(userId: string, role: Role, amount: number) {
  assertRole(role, [Role.INVESTOR], 'Only investors can deposit into the pool')

  const wallet = await requirePrimaryWallet(userId)
  const normalizedAmount = Math.trunc(amount)

  if (normalizedAmount <= 0) {
    throw new AppError('Deposit amount must be positive', 400)
  }

  let tokenBalance = 0
  let balanceReadable = true
  let trustlineRequired = false

  try {
    tokenBalance = await readTokenBalance(wallet.walletAddress)
  } catch {
    balanceReadable = false
    trustlineRequired = Boolean(stellarConfig.tokenTrustlineAsset)
  }

  return {
    walletAddress: wallet.walletAddress,
    tokenAddress: stellarConfig.tokenAddress,
    trustlineAsset: stellarConfig.tokenTrustlineAsset,
    amount: normalizedAmount,
    tokenBalance,
    balanceReadable,
    trustlineRequired,
    fundingRequired: tokenBalance < normalizedAmount,
    autoFundingAvailable: Boolean(
      stellarConfig.tokenTrustlineAsset &&
        stellarConfig.tokenIssuerAccount &&
        stellarConfig.tokenIssuerSecretKey,
    ),
    trustline:
      trustlineRequired && stellarConfig.tokenTrustlineAsset
        ? await buildInvestorTrustlineInvocation(userId, role)
        : null,
    approve: null,
    deposit: null,
  }
}

export async function fundInvestorTokenBalance(
  userId: string,
  role: Role,
  amount: number,
) {
  assertRole(role, [Role.INVESTOR], 'Only investors can receive deposit funding')

  if (!stellarConfig.tokenTrustlineAsset) {
    throw new AppError(
      'Token trustline asset is not configured on the backend. Set STELLAR_TOKEN_TRUSTLINE_ASSET first.',
      503,
    )
  }

  if (!stellarConfig.tokenIssuerAccount || !stellarConfig.tokenIssuerSecretKey) {
    throw new AppError(
      'Automatic IFX funding is not configured. Set STELLAR_TOKEN_ISSUER_ACCOUNT and STELLAR_TOKEN_ISSUER_SECRET_KEY, or pre-fund the investor wallet with IFX before depositing.',
      503,
    )
  }

  const wallet = await requirePrimaryWallet(userId)
  const normalizedAmount = Math.trunc(amount)

  if (normalizedAmount <= 0) {
    throw new AppError('Funding amount must be positive', 400)
  }

  const args = [
    'tx',
    'new',
    'payment',
    '--source-account',
    stellarConfig.tokenIssuerAccount,
    '--sign-with-key',
    stellarConfig.tokenIssuerSecretKey,
    '--destination',
    wallet.walletAddress,
    '--asset',
    stellarConfig.tokenTrustlineAsset,
    '--amount',
    String(normalizedAmount),
  ]
  appendRpcArgs(args)

  const { stdout } = await runStellarCommand(args)
  const parsedOutput = parseCliOutput(stdout)
  const transactionHash = extractTransactionHash(parsedOutput)
  console.log(
    `[contract] fundInvestorTokenBalance: user=${userId} wallet=${wallet.walletAddress} amount=${normalizedAmount} hash=${
      transactionHash ?? 'unknown'
    }`,
  )

  const confirmedOutput = transactionHash
    ? await waitForTransactionResult(transactionHash)
    : parsedOutput
  if (transactionHash) {
    console.log(
      `[contract] fundInvestorTokenBalance: confirmed transaction hash=${transactionHash}`,
    )
  }

  return {
    function: 'fund_investor_token_balance',
    sourceAccount: stellarConfig.tokenIssuerAccount,
    mode: 'build' as const,
    commandPreview: buildCommandPreview(
      [stellarConfig.cliPath, 'tx', 'new', 'payment', '--source-account', stellarConfig.tokenIssuerAccount, '--destination', wallet.walletAddress, '--asset', stellarConfig.tokenTrustlineAsset, '--amount', String(normalizedAmount)],
      false,
    ),
    output: confirmedOutput,
  }
}

export function submitInvestorSignedTransaction(signedXdr: string) {
  return submitSignedTransaction(signedXdr)
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

export async function buildVerifyInvoiceInvocation(userId: string, role: Role, invoiceId: string) {
  assertRole(role, [Role.CUSTOMER], 'Only the assigned customer can verify invoices')

  const sourceAccount = (await requirePrimaryWallet(userId)).walletAddress

  return buildContractInvocation(sourceAccount, 'verify_invoice', {
    customer: sourceAccount,
    invoice_id: invoiceId,
  })
}

export async function buildRejectInvoiceInvocation(userId: string, role: Role, invoiceId: string) {
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
  requestId: string,
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
  requestId: string,
) {
  assertRole(role, [Role.ADMIN], 'Only administrators can reject financing on-chain')

  const wallet = await requireAdminPrimaryWallet(userId)
  const sourceAccount = stellarConfig.adminSourceAccount ?? wallet.walletAddress
  return buildContractInvocation(sourceAccount, 'reject_financing', {
    admin: sourceAccount,
    request_id: requestId,
  })
}

export async function buildBorrowInvocation(userId: string, role: Role, requestId: string) {
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
  requestId: string,
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
