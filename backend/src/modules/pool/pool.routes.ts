import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import { depositSchema, withdrawSchema } from './pool.schemas'
import {
  depositToPool,
  getInvestorPosition,
  getPoolInfo,
  withdrawFromPool,
} from './pool.service'

const router = Router()

/**
 * @openapi
 * /api/pool/deposit:
 *   post:
 *     tags: [Pool]
 *     summary: Deposit liquidity into the shared pool
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             amount: 5000
 *     responses:
 *       200:
 *         description: Deposit recorded successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Pool deposit recorded successfully
 *               data:
 *                 deposit:
 *                   id: "clx_dep"
 *                   investorId: "clx_user"
 *                   walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                   amount: 5000
 *                   sharesReceived: 5000
 *                   transactionHash: "deposit_clx_user_deadbeef"
 *                   createdAt: "2026-06-03T12:00:00.000Z"
 *                 pool:
 *                   totalLiquidity: 5000
 *                   availableLiquidity: 5000
 *                   totalShares: 5000
 *                   totalLoans: 0
 *                   outstandingLoans: 0
 *                   sharePrice: 1
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only investors can deposit
 */
router.post('/deposit', authenticate, validate(depositSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await depositToPool(
      authReq.user.id,
      authReq.user.role,
      req.body.amount,
    )

    res.json(successResponse('Pool deposit recorded successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/pool/withdraw:
 *   post:
 *     tags: [Pool]
 *     summary: Withdraw liquidity from the shared pool using pool shares
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             shareAmount: 2500
 *     responses:
 *       200:
 *         description: Withdrawal recorded successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Pool withdrawal recorded successfully
 *               data:
 *                 withdrawal:
 *                   id: "clx_dep"
 *                   investorId: "clx_user"
 *                   walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                   amount: 2700
 *                   sharesRedeemed: 2500
 *                   transactionHash: "withdraw_clx_user_deadbeef"
 *                   createdAt: "2026-06-03T12:00:00.000Z"
 *                 pool:
 *                   totalLiquidity: 8100
 *                   availableLiquidity: 8100
 *                   totalShares: 7500
 *                   totalLoans: 1
 *                   outstandingLoans: 0
 *                   sharePrice: 1.08
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
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
 *     summary: Get aggregate liquidity pool information
 *     responses:
 *       200:
 *         description: Pool information returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Pool information fetched successfully
 *               data:
 *                 totalLiquidity: 10800
 *                 availableLiquidity: 10800
 *                 totalShares: 10000
 *                 totalLoans: 1
 *                 outstandingLoans: 0
 *                 sharePrice: 1.08
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
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
 *     summary: Get the authenticated investor's current pool position
 *     responses:
 *       200:
 *         description: Investor position returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Pool position fetched successfully
 *               data:
 *                 sharesOwned: 5000
 *                 currentValue: 5400
 *                 deposits: 5000
 *                 earnedInterest: 400
 *                 poolSharePercentage: 50
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
