import { Role } from '@prisma/client'
import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
  authorize,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import {
  buildCreateInvoiceInvocation,
  buildApproveFinancingInvocation,
  buildBorrowInvocation,
  buildDepositInvocation,
  buildInvestorTrustlineInvocation,
  buildTokenApproveInvocation,
  buildRejectFinancingInvocation,
  buildRejectInvoiceInvocation,
  buildRequestFinancingInvocation,
  buildSettleInvoiceInvocation,
  buildVerifyInvoiceInvocation,
  buildWithdrawInvocation,
  buildWithdrawPlatformFeesInvocation,
  fundInvestorTokenBalance,
  getContractFinancingRequest,
  getContractInvoice,
  getContractInvestorPosition,
  getContractMetadata,
  getContractPoolInfo,
  getTokenMetadata,
  prepareInvestorDepositFlow,
  submitInvestorSignedTransaction,
} from './contract.service'
import {
  contractIdParamSchema,
  createInvoiceBuildSchema,
  depositBuildSchema,
  requestFinancingBuildSchema,
  submitSignedTransactionSchema,
  tokenApproveBuildSchema,
  withdrawBuildSchema,
  withdrawPlatformFeesSchema,
} from './contract.schemas'

const router = Router()

router.get('/metadata', authenticate, async (_req, res, next) => {
  try {
    res.json(successResponse('Contract metadata fetched successfully', getContractMetadata()))
  } catch (error) {
    next(error)
  }
})

router.get('/pool', authenticate, async (_req, res, next) => {
  try {
    const payload = await getContractPoolInfo()
    res.json(successResponse('Contract pool info fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

router.get('/token/metadata', authenticate, async (_req, res, next) => {
  try {
    const payload = await getTokenMetadata()
    res.json(successResponse('Token metadata fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

router.get(
  '/position/me',
  authenticate,
  authorize(Role.INVESTOR),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await getContractInvestorPosition(authReq.user.id, authReq.user.role)
      res.json(successResponse('Contract investor position fetched successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.get('/invoices/:id', authenticate, validate(contractIdParamSchema), async (req, res, next) => {
  try {
    const payload = await getContractInvoice(Number(req.params.id))
    res.json(successResponse('Contract invoice fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

router.get('/requests/:id', authenticate, validate(contractIdParamSchema), async (req, res, next) => {
  try {
    const payload = await getContractFinancingRequest(Number(req.params.id))
    res.json(successResponse('Contract financing request fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

router.post(
  '/actions/deposit/prepare',
  authenticate,
  authorize(Role.INVESTOR),
  validate(depositBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await prepareInvestorDepositFlow(
        authReq.user.id,
        authReq.user.role,
        req.body.amount,
      )
      res.json(successResponse('Investor deposit flow prepared successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/deposit',
  authenticate,
  authorize(Role.INVESTOR),
  validate(depositBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildDepositInvocation(
        authReq.user.id,
        authReq.user.role,
        req.body.amount,
      )
      res.json(successResponse('Contract deposit invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/token/approve',
  authenticate,
  authorize(Role.INVESTOR, Role.CUSTOMER),
  validate(tokenApproveBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildTokenApproveInvocation(
        authReq.user.id,
        authReq.user.role,
        req.body.amount,
      )
      res.json(successResponse('Token approve invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/token/trustline',
  authenticate,
  authorize(Role.INVESTOR),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildInvestorTrustlineInvocation(authReq.user.id, authReq.user.role)
      res.json(successResponse('Investor trustline transaction built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/token/fund',
  authenticate,
  authorize(Role.INVESTOR),
  validate(tokenApproveBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      console.log(
        `[contract] POST /api/contract/actions/token/fund user=${authReq.user.id} amount=${req.body.amount}`,
      )
      const payload = await fundInvestorTokenBalance(
        authReq.user.id,
        authReq.user.role,
        req.body.amount,
      )
      res.json(successResponse('Investor token funding submitted successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/submit',
  authenticate,
  validate(submitSignedTransactionSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      console.log(
        `[contract] POST /api/contract/actions/submit user=${authReq.user.id} xdrLength=${
          req.body.signedXdr?.length ?? 0
        } preview=${req.body.signedXdr?.slice(0, 32) ?? 'N/A'}`,
      )
      // Additional diagnostics to help detect unsigned or malformed payloads
      try {
        const raw = req.body.signedXdr
        console.log('[contract] POST /api/contract/actions/submit: signedXdr type=', typeof raw)
        if (typeof raw === 'string') {
          const isBase64 = /^[A-Za-z0-9+/=]+$/.test(raw)
          console.log('[contract] POST /api/contract/actions/submit: base64-ish=', isBase64)
          console.log('[contract] POST /api/contract/actions/submit: preview start=', raw.slice(0, 32))
          console.log('[contract] POST /api/contract/actions/submit: preview end=', raw.slice(-16))
        } else {
          console.log('[contract] POST /api/contract/actions/submit: signedXdr is not a string')
        }
      } catch (logErr) {
        console.log('[contract] error while logging signedXdr diagnostics', logErr)
      }
      // Normalize incoming payload: accept either a raw signed XDR string
      // or an object containing `{ signedTxXdr: string }` (some clients may wrap it)
      const rawBody = req.body.signedXdr
      const normalizedSignedXdr =
        typeof rawBody === 'string'
          ? rawBody
          : rawBody && typeof rawBody === 'object' && 'signedTxXdr' in rawBody
          ? (rawBody as any).signedTxXdr
          : undefined

      console.log('[contract] POST /api/contract/actions/submit: normalizedSignedXdr type=', typeof normalizedSignedXdr)

      const payload = await submitInvestorSignedTransaction(normalizedSignedXdr)
      res.json(successResponse('Signed Stellar transaction submitted successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/withdraw',
  authenticate,
  authorize(Role.INVESTOR),
  validate(withdrawBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildWithdrawInvocation(
        authReq.user.id,
        authReq.user.role,
        req.body.shareAmount,
      )
      res.json(successResponse('Contract withdrawal invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/invoices',
  authenticate,
  authorize(Role.BORROWER),
  validate(createInvoiceBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildCreateInvoiceInvocation(
        authReq.user.id,
        authReq.user.role,
        req.body,
      )
      res.json(successResponse('Contract create-invoice invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/invoices/:id/verify',
  authenticate,
  authorize(Role.CUSTOMER),
  validate(contractIdParamSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildVerifyInvoiceInvocation(
        authReq.user.id,
        authReq.user.role,
        Number(req.params.id),
      )
      res.json(successResponse('Contract verify-invoice invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/invoices/:id/reject',
  authenticate,
  authorize(Role.ADMIN, Role.CUSTOMER),
  validate(contractIdParamSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildRejectInvoiceInvocation(
        authReq.user.id,
        authReq.user.role,
        Number(req.params.id),
      )
      res.json(successResponse('Contract reject-invoice invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/financing/request',
  authenticate,
  authorize(Role.BORROWER),
  validate(requestFinancingBuildSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildRequestFinancingInvocation(
        authReq.user.id,
        authReq.user.role,
        req.body,
      )
      res.json(successResponse('Contract financing-request invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/financing/:id/approve',
  authenticate,
  authorize(Role.ADMIN),
  validate(contractIdParamSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildApproveFinancingInvocation(
        authReq.user.id,
        authReq.user.role,
        Number(req.params.id),
      )
      res.json(successResponse('Contract approve-financing invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/financing/:id/reject',
  authenticate,
  authorize(Role.ADMIN),
  validate(contractIdParamSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildRejectFinancingInvocation(
        authReq.user.id,
        authReq.user.role,
        Number(req.params.id),
      )
      res.json(successResponse('Contract reject-financing invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/financing/:id/borrow',
  authenticate,
  authorize(Role.BORROWER),
  validate(contractIdParamSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildBorrowInvocation(
        authReq.user.id,
        authReq.user.role,
        Number(req.params.id),
      )
      res.json(successResponse('Contract borrow invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/settlements/:id/pay',
  authenticate,
  authorize(Role.CUSTOMER),
  validate(contractIdParamSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildSettleInvoiceInvocation(
        authReq.user.id,
        authReq.user.role,
        Number(req.params.id),
      )
      res.json(successResponse('Contract settlement invocation built successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/actions/platform-fees/withdraw',
  authenticate,
  authorize(Role.ADMIN),
  validate(withdrawPlatformFeesSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await buildWithdrawPlatformFeesInvocation(
        authReq.user.id,
        authReq.user.role,
        req.body.amount,
      )
      res.json(
        successResponse('Contract platform-fee withdrawal invocation built successfully', payload),
      )
    } catch (error) {
      next(error)
    }
  },
)

export const contractRouter = router
