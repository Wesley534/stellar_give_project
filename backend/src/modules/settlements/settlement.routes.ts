import { Router } from 'express'
import { Role } from '@prisma/client'

import {
  authenticate,
  AuthenticatedRequest,
  authorize,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import { finalizeSettlementSchema, settlementIdSchema } from './settlement.schemas'
import {
  getSettlementByRequestId,
  payInvoiceSettlement,
  prepareSettlementPayment,
} from './settlement.service'

const router = Router()

/**
 * @openapi
 * /api/settlements/{id}/pay-invoice:
 *   post:
 *     tags: [Settlements]
 *     summary: Settle a funded invoice as the customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice settled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the assigned customer or admin can settle
 *       404:
 *         description: Financing request not found
 */
router.post(
  '/:id/pay-invoice/prepare',
  authenticate,
  authorize(Role.CUSTOMER),
  validate(settlementIdSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const requestId = req.params.id as string
      const payload = await prepareSettlementPayment(
        requestId,
        authReq.user.id,
        authReq.user.role,
      )
      res.json(successResponse('Invoice settlement transaction prepared successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/:id/pay-invoice',
  authenticate,
  authorize(Role.CUSTOMER),
  validate(finalizeSettlementSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const requestId = req.params.id as string
      const payload = await payInvoiceSettlement(
        requestId,
        authReq.user.id,
        authReq.user.role,
        req.body.transactionHash,
      )
      res.json(successResponse('Invoice settled successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @openapi
 * /api/settlements/{id}:
 *   get:
 *     tags: [Settlements]
 *     summary: Get settlement details for a financing request
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settlement returned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Settlement not found
 */
router.get('/:id', authenticate, validate(settlementIdSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const requestId = req.params.id as string
    const payload = await getSettlementByRequestId(
      requestId,
      authReq.user.id,
      authReq.user.role,
    )
    res.json(successResponse('Settlement fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

export const settlementRouter = router
