import { Router } from 'express'
import { Role } from '@prisma/client'

import {
  authenticate,
  AuthenticatedRequest,
  authorize,
} from '../../middlewares/auth.middleware'
import { successResponse } from '../../utils/api-response'
import { listUsers, findUserById } from './user.service'

const router = Router()

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get the currently authenticated user
 *     responses:
 *       200:
 *         description: User profile returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Current user fetched successfully
 *               data:
 *                 id: "ckx123"
 *                 name: "Jane Doe"
 *                 email: "jane@example.com"
 *                 role: "BORROWER"
 *                 createdAt: "2026-06-02T12:00:00.000Z"
 *                 updatedAt: "2026-06-02T12:00:00.000Z"
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const user = await findUserById(authReq.user.id)
    res.json(successResponse('Current user fetched successfully', user))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     responses:
 *       200:
 *         description: Users returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Users fetched successfully
 *               data:
 *                 - id: "ckx123"
 *                   name: "Admin User"
 *                   email: "admin@example.com"
 *                   role: "ADMIN"
 *                   createdAt: "2026-06-02T12:00:00.000Z"
 *                   updatedAt: "2026-06-02T12:00:00.000Z"
 *       403:
 *         description: Forbidden
 */
router.get('/', authenticate, authorize(Role.ADMIN, Role.BORROWER), async (req, res, next) => {
  try {
    const role = req.query.role as Role | undefined
    const users = await listUsers(role)
    res.json(successResponse('Users fetched successfully', users))
  } catch (error) {
    next(error)
  }
})

export const userRouter = router
