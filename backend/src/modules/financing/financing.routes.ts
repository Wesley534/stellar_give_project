import { FinancingStatus } from '@prisma/client'
import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import {
  createFinancingSchema,
  financingIdSchema,
  listFinancingSchema,
  reviewFinancingSchema,
} from './financing.schemas'
import {
  approveFinancingRequest,
  borrowAgainstFinancing,
  createFinancingRequest,
  getFinancingRequestById,
  listFinancingRequests,
  rejectFinancingRequest,
} from './financing.service'

const router = Router()

/**
 * @openapi
 * /api/financing/request:
 *   post:
 *     tags: [Financing]
 *     summary: Create a financing request for a verified invoice
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             invoiceId: "clx_invoice_123"
 *     responses:
 *       201:
 *         description: Financing request created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only suppliers can create financing requests
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/request',
  authenticate,
  validate(createFinancingSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await createFinancingRequest(
        authReq.user.id,
        authReq.user.role,
        req.body.invoiceId,
      )
      res.status(201).json(successResponse('Financing request created successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @openapi
 * /api/financing:
 *   get:
 *     tags: [Financing]
 *     summary: List financing requests visible to the authenticated user
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - PENDING_APPROVAL
 *             - APPROVED
 *             - REJECTED
 *             - ACTIVE
 *             - SETTLED
 *     responses:
 *       200:
 *         description: Financing requests returned successfully
 *       401:
 *         description: Unauthorized
 */
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
 *     summary: Approve a pending financing request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             note: "Verified invoice and sufficient pool coverage"
 *     responses:
 *       200:
 *         description: Financing request approved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only administrators can approve financing requests
 *       404:
 *         description: Financing request not found
 */
router.post(
  '/:id/approve',
  authenticate,
  validate(reviewFinancingSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const requestId = req.params.id as string
      const payload = await approveFinancingRequest(
        requestId,
        authReq.user.id,
        authReq.user.role,
        req.body.note,
      )
      res.json(successResponse('Financing request approved successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @openapi
 * /api/financing/{id}/reject:
 *   post:
 *     tags: [Financing]
 *     summary: Reject a pending financing request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           example:
 *             note: "Customer verification could not be validated"
 *     responses:
 *       200:
 *         description: Financing request rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only administrators can reject financing requests
 *       404:
 *         description: Financing request not found
 */
router.post(
  '/:id/reject',
  authenticate,
  validate(reviewFinancingSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const requestId = req.params.id as string
      const payload = await rejectFinancingRequest(
        requestId,
        authReq.user.role,
        req.body.note,
      )
      res.json(successResponse('Financing request rejected successfully', payload))
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
 *     summary: Disburse approved financing to the supplier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Financing disbursed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the supplier who created the request can borrow
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
    res.json(successResponse('Financing disbursed successfully', payload))
  } catch (error) {
    next(error)
  }
})

export const financingRouter = router
