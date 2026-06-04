import { InvoiceStatus } from '@prisma/client'
import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import {
  createInvoiceSchema,
  invoiceIdSchema,
  listInvoicesSchema,
  rejectInvoiceSchema,
} from './invoice.schemas'
import {
  createInvoice,
  getInvoiceById,
  listInvoices,
  rejectInvoice,
  verifyInvoice,
} from './invoice.service'

const router = Router()

/**
 * @openapi
 * /api/invoices:
 *   post:
 *     tags: [Invoices]
 *     summary: Create a supplier invoice for financing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             customerName: "Acme Retail Ltd"
 *             customerWalletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *             invoiceNumber: "INV-2026-001"
 *             invoiceAmount: 10000
 *             dueDate: "2026-07-15T00:00:00.000Z"
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only suppliers can create invoices
 *   get:
 *     tags: [Invoices]
 *     summary: List invoices visible to the authenticated user
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - PENDING_VERIFICATION
 *             - VERIFIED
 *             - FINANCING_REQUESTED
 *             - FUNDED
 *             - SETTLED
 *             - CLOSED
 *             - REJECTED
 *     responses:
 *       200:
 *         description: Invoices returned successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, validate(createInvoiceSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await createInvoice(authReq.user.id, authReq.user.role, req.body)
    res.status(201).json(successResponse('Invoice created successfully', payload))
  } catch (error) {
    next(error)
  }
})

router.get('/', authenticate, validate(listInvoicesSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await listInvoices(
      authReq.user.id,
      authReq.user.role,
      req.query.status as InvoiceStatus | undefined,
    )
    res.json(successResponse('Invoices fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get a single invoice by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice returned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Invoice not found
 */
router.get('/:id', authenticate, validate(invoiceIdSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const invoiceId = req.params.id as string
    const payload = await getInvoiceById(invoiceId, authReq.user.id, authReq.user.role)
    res.json(successResponse('Invoice fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/invoices/{id}/verify:
 *   post:
 *     tags: [Invoices]
 *     summary: Verify an invoice as the customer or admin
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice verified successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the assigned customer or admin can verify
 *       404:
 *         description: Invoice not found
 */
router.post('/:id/verify', authenticate, validate(invoiceIdSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const invoiceId = req.params.id as string
    const payload = await verifyInvoice(invoiceId, authReq.user.id, authReq.user.role)
    res.json(successResponse('Invoice verified successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/invoices/{id}/reject:
 *   post:
 *     tags: [Invoices]
 *     summary: Reject an invoice as the customer or admin
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the assigned customer or admin can reject
 *       404:
 *         description: Invoice not found
 */
router.post('/:id/reject', authenticate, validate(rejectInvoiceSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const invoiceId = req.params.id as string
    const payload = await rejectInvoice(invoiceId, authReq.user.id, authReq.user.role)
    res.json(successResponse('Invoice rejected successfully', payload))
  } catch (error) {
    next(error)
  }
})

export const invoiceRouter = router
