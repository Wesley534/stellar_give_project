import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import { connectWalletSchema } from './wallet.schemas'
import { connectWallet, listUserWallets } from './wallet.service'

const router = Router()

/**
 * @openapi
 * /api/wallets/connect:
 *   post:
 *     tags: [Wallets]
 *     summary: Connect or update the authenticated user's primary Freighter wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *             network: "TESTNET"
 *     responses:
 *       200:
 *         description: Wallet connected successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Wallet connected successfully
 *               data:
 *                 wallet:
 *                   id: "clx_wallet"
 *                   userId: "clx_user"
 *                   walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                   network: "TESTNET"
 *                   isPrimary: true
 *                   connectionDate: "2026-06-03T12:00:00.000Z"
 *                   createdAt: "2026-06-03T12:00:00.000Z"
 *                 stellar:
 *                   network: "testnet"
 *                   contractId: "invoice-finance-pool"
 *                   tokenAddress: "sep41-token-address"
 *                   transactionHash: "connect_wallet_clx_wallet_deadbeef"
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 */
router.post('/connect', authenticate, validate(connectWalletSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await connectWallet(
      authReq.user.id,
      req.body.walletAddress,
      req.body.network,
    )

    res.json(successResponse('Wallet connected successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/wallets/me:
 *   get:
 *     tags: [Wallets]
 *     summary: Get all wallets for the authenticated user
 *     responses:
 *       200:
 *         description: Wallets returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Wallets fetched successfully
 *               data:
 *                 primaryWallet:
 *                   id: "clx_wallet"
 *                   userId: "clx_user"
 *                   walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                   network: "TESTNET"
 *                   isPrimary: true
 *                   connectionDate: "2026-06-03T12:00:00.000Z"
 *                   createdAt: "2026-06-03T12:00:00.000Z"
 *                 wallets:
 *                   - id: "clx_wallet"
 *                     userId: "clx_user"
 *                     walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
 *                     network: "TESTNET"
 *                     isPrimary: true
 *                     connectionDate: "2026-06-03T12:00:00.000Z"
 *                     createdAt: "2026-06-03T12:00:00.000Z"
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const payload = await listUserWallets(authReq.user.id)
    res.json(successResponse('Wallets fetched successfully', payload))
  } catch (error) {
    next(error)
  }
})

export const walletRouter = router
