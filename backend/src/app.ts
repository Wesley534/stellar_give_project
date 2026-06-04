import cors from 'cors'
import express from 'express'

import { env } from './config/env'
import { swaggerDocs } from './config/swagger'
import { authRouter } from './modules/auth/auth.routes'
import { financingRouter } from './modules/financing/financing.routes'
import { invoiceRouter } from './modules/invoices/invoice.routes'
import { poolRouter } from './modules/pool/pool.routes'
import { settlementRouter } from './modules/settlements/settlement.routes'
import { userRouter } from './modules/users/user.routes'
import { walletRouter } from './modules/wallets/wallet.routes'
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error.middleware'

export const app = express()

app.use(
  cors({
    origin: env.FRONTEND_URL,
  }),
)
app.use(express.json())

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     security: []
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: API is healthy
 *               data:
 *                 status: "ok"
 */
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    data: {
      status: 'ok',
    },
  })
})

app.use('/api/auth', authRouter)
app.use('/api/users', userRouter)
app.use('/api/wallets', walletRouter)
app.use('/api/pool', poolRouter)
app.use('/api/invoices', invoiceRouter)
app.use('/api/financing', financingRouter)
app.use('/api/settlements', settlementRouter)
app.use('/api-docs', swaggerDocs.serve, swaggerDocs.setup)

app.use(notFoundHandler)
app.use(errorHandler)
