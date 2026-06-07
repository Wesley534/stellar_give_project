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
  buildRejectFinancingInvocation,
  buildRejectInvoiceInvocation,
  buildRequestFinancingInvocation,
  buildSettleInvoiceInvocation,
  buildVerifyInvoiceInvocation,
  buildWithdrawInvocation,
  buildWithdrawPlatformFeesInvocation,
  getContractFinancingRequest,
  getContractInvoice,
  getContractInvestorPosition,
  getContractMetadata,
  getContractPoolInfo,
} from './contract.service'
import {
  contractIdParamSchema,
  createInvoiceBuildSchema,
  depositBuildSchema,
  requestFinancingBuildSchema,
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
