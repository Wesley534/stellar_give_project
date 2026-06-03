import { FinancingStatus } from '@prisma/client'
import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import {
  approveFinancingSchema,
  createFinancingSchema,
  financingIdSchema,
  listFinancingSchema,
  repayFinancingSchema,
} from './financing.schemas'
import {
  borrowAgainstFinancing,
  createFinancingRequest,
  getFinancingRequestById,
  listFinancingRequests,
  repayFinancing,
  reviewFinancingRequest,
} from './financing.service'

const router = Router()

/**
 * @openapi
 * /api/financing:
 *   post:
 *     tags: [Financing]
 *     summary: Create a financing request for an invoice
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             invoiceNumber: "INV-2026-001"
 *             invoiceAmount: 10000
 *             borrowAmount: 8000
 *             repaymentAmount: 8800
 *             dueDate: "2026-07-15T00:00:00.000Z"
 *             description: "Working capital for supplier restocking"
 *     responses:
 *       201:
 *         description: Financing request created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Financing request created successfully
 *               data:
 *                 request:
 *                   id: "clx_req"
 *                   borrowerId: "clx_user"
 *                   walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                   invoiceNumber: "INV-2026-001"
 *                   invoiceAmount: 10000
 *                   borrowAmount: 8000
 *                   repaymentAmount: 8800
 *                   dueDate: "2026-07-15T00:00:00.000Z"
 *                   description: "Working capital for supplier restocking"
 *                   status: "PENDING_ADMIN_REVIEW"
 *                   contractRequestId: "req_clx_req"
 *                   createdAt: "2026-06-03T12:00:00.000Z"
 *                   updatedAt: "2026-06-03T12:00:00.000Z"
 *                   repayments: []
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
 *                   transactionHash: "create_financing_request_clx_req_deadbeef"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only borrowers can create financing requests
 *   get:
 *     tags: [Financing]
 *     summary: List financing requests visible to the authenticated user
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - PENDING_ADMIN_REVIEW
 *             - APPROVED
 *             - REJECTED
 *             - BORROWED
 *             - REPAID
 *             - CLOSED
 *     responses:
 *       200:
 *         description: Financing requests returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Financing requests fetched successfully
 *               data:
 *                 - id: "clx_req"
 *                   borrowerId: "clx_user"
 *                   walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                   invoiceNumber: "INV-2026-001"
 *                   invoiceAmount: 10000
 *                   borrowAmount: 8000
 *                   repaymentAmount: 8800
 *                   dueDate: "2026-07-15T00:00:00.000Z"
 *                   description: "Working capital for supplier restocking"
 *                   status: "APPROVED"
 *                   contractRequestId: "req_clx_req"
 *                   repayments: []
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, validate(createFinancingSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await createFinancingRequest(authReq.user.id, authReq.user.role, req.body)
    res.status(201).json(successResponse('Financing request created successfully', payload))
  } catch (error) {
    next(error)
  }
})

router.get('/', authenticate, validate(listFinancingSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await listFinancingRequests(
      authReq.user.id,
      authReq.user.role,
      req.query.status as FinancingStatus | undefined,
    )
    res.json(successResponse('Financing requests fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/financing/{id}:
 *   get:
 *     tags: [Financing]
 *     summary: Get a single financing request by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Financing request returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Financing request fetched successfully
 *               data:
 *                 id: "clx_req"
 *                 borrowerId: "clx_user"
 *                 walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                 invoiceNumber: "INV-2026-001"
 *                 invoiceAmount: 10000
 *                 borrowAmount: 8000
 *                 repaymentAmount: 8800
 *                 dueDate: "2026-07-15T00:00:00.000Z"
 *                 description: "Working capital for supplier restocking"
 *                 status: "BORROWED"
 *                 contractRequestId: "req_clx_req"
 *                 repayments:
 *                   - id: "clx_rep"
 *                     amount: 8800
 *                     walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                     transactionHash: "repay_clx_req_deadbeef"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Financing request not found
 */
router.get('/:id', authenticate, validate(financingIdSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const requestId = req.params.id as string
    const payload = await getFinancingRequestById(
      requestId,
      authReq.user.id,
      authReq.user.role,
    )
    res.json(successResponse('Financing request fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/financing/{id}/approve:
 *   post:
 *     tags: [Financing]
 *     summary: Approve or reject a pending financing request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             action: "APPROVE"
 *             note: "Invoice verified and eligible"
 *     responses:
 *       200:
 *         description: Financing request reviewed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Financing request reviewed successfully
 *               data:
 *                 request:
 *                   id: "clx_req"
 *                   status: "APPROVED"
 *                   approvalNote: "Invoice verified and eligible"
 *                   approvedById: "clx_admin"
 *                   approvedAt: "2026-06-03T13:00:00.000Z"
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
 *                   transactionHash: "approve_request_clx_req_deadbeef"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only administrators can review financing requests
 *       404:
 *         description: Financing request not found
 */
router.post(
  '/:id/approve',
  authenticate,
  validate(approveFinancingSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const requestId = req.params.id as string
      const payload = await reviewFinancingRequest(
        requestId,
        authReq.user.id,
        authReq.user.role,
        req.body.action,
        req.body.note,
      )
      res.json(successResponse('Financing request reviewed successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @openapi
 * /api/financing/{id}/borrow:
 *   post:
 *     tags: [Financing]
 *     summary: Borrow funds for an approved financing request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Borrow transaction recorded successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Financing request borrowed successfully
 *               data:
 *                 request:
 *                   id: "clx_req"
 *                   status: "BORROWED"
 *                   borrowedAt: "2026-06-03T14:00:00.000Z"
 *                 pool:
 *                   totalLiquidity: 10000
 *                   availableLiquidity: 2000
 *                   totalShares: 10000
 *                   totalLoans: 1
 *                   outstandingLoans: 8000
 *                   sharePrice: 1
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
 *                   transactionHash: "borrow_clx_req_deadbeef"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the borrower who created the request can borrow
 *       404:
 *         description: Financing request not found
 */
router.post('/:id/borrow', authenticate, validate(financingIdSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const requestId = req.params.id as string
    const payload = await borrowAgainstFinancing(
      requestId,
      authReq.user.id,
      authReq.user.role,
    )
    res.json(successResponse('Financing request borrowed successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/financing/{id}/repay:
 *   post:
 *     tags: [Financing]
 *     summary: Repay a borrowed financing request with interest
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             amount: 8800
 *     responses:
 *       200:
 *         description: Repayment recorded successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Financing request repaid successfully
 *               data:
 *                 request:
 *                   id: "clx_req"
 *                   status: "REPAID"
 *                   repaidAt: "2026-06-10T12:00:00.000Z"
 *                   repayments:
 *                     - id: "clx_rep"
 *                       amount: 8800
 *                       walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                       transactionHash: "repay_clx_req_deadbeef"
 *                 pool:
 *                   totalLiquidity: 10800
 *                   availableLiquidity: 10800
 *                   totalShares: 10000
 *                   totalLoans: 1
 *                   outstandingLoans: 0
 *                   sharePrice: 1.08
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
 *                   transactionHash: "repay_clx_req_deadbeef"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the borrower who created the request can repay
 *       404:
 *         description: Financing request not found
 */
router.post(
  '/:id/repay',
  authenticate,
  validate(repayFinancingSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const requestId = req.params.id as string
      const payload = await repayFinancing(
        requestId,
        authReq.user.id,
        authReq.user.role,
        req.body.amount,
      )
      res.json(successResponse('Financing request repaid successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

export const financingRouter = router
