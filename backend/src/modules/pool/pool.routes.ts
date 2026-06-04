import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import {
  fiatSimulationDepositSchema,
  withdrawSchema,
  xlmDepositSchema,
} from './pool.schemas'
import {
  getInvestorPosition,
  getPoolInfo,
  recordXlmDeposit,
  simulateFiatDeposit,
  withdrawFromPool,
} from './pool.service'

const router = Router()

/**
 * @openapi
 * /api/pool/deposit/xlm:
 *   post:
 *     tags: [Pool]
 *     summary: Record a real Stellar Testnet XLM liquidity deposit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             sourceAmount: 500
 *             transactionHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
 *     responses:
 *       200:
 *         description: XLM deposit recorded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only investors can deposit
 */
router.post(
  '/deposit/xlm',
  authenticate,
  validate(xlmDepositSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await recordXlmDeposit(
        authReq.user.id,
        authReq.user.role,
        req.body.sourceAmount,
        req.body.transactionHash,
      )

      res.json(successResponse('XLM pool deposit recorded successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @openapi
 * /api/pool/deposit/fiat-simulation:
 *   post:
 *     tags: [Pool]
 *     summary: Simulate a fiat deposit and mint pool shares for MVP demo flows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             kesAmount: 100000
 *     responses:
 *       200:
 *         description: Fiat simulation deposit recorded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only investors can deposit
 */
router.post(
  '/deposit/fiat-simulation',
  authenticate,
  validate(fiatSimulationDepositSchema),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest
      const payload = await simulateFiatDeposit(
        authReq.user.id,
        authReq.user.role,
        req.body.kesAmount,
      )

      res.json(successResponse('Fiat simulation deposit recorded successfully', payload))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @openapi
 * /api/pool/withdraw:
 *   post:
 *     tags: [Pool]
 *     summary: Withdraw pool liquidity by redeeming investor shares
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             shareAmount: 250
 *     responses:
 *       200:
 *         description: Pool withdrawal recorded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only investors can withdraw
 */
router.post('/withdraw', authenticate, validate(withdrawSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await withdrawFromPool(
      authReq.user.id,
      authReq.user.role,
      req.body.shareAmount,
    )

    res.json(successResponse('Pool withdrawal recorded successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/pool/info:
 *   get:
 *     tags: [Pool]
 *     summary: Get aggregate invoice-financing pool metrics
 *     responses:
 *       200:
 *         description: Pool information returned successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/info', authenticate, async (_req, res, next) => {
  try {
    const payload = await getPoolInfo()
    res.json(successResponse('Pool information fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/pool/position:
 *   get:
 *     tags: [Pool]
 *     summary: Get the authenticated investor's pool position and yield
 *     responses:
 *       200:
 *         description: Pool position returned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only investors can access pool positions
 */
router.get('/position', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await getInvestorPosition(authReq.user.id, authReq.user.role)
    res.json(successResponse('Pool position fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

export const poolRouter = router
