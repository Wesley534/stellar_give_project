import { Router } from 'express'

import {
  authenticate,
  AuthenticatedRequest,
} from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { successResponse } from '../../utils/api-response'
import { getCurrentUser } from './auth.controller'
import { loginSchema, registerSchema } from './auth.schemas'
import { loginUser, registerUser } from './auth.service'

const router = Router()

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "Jane Doe"
 *             email: "jane@example.com"
 *             password: "password123"
 *             role: "CUSTOMER"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: User registered successfully
 *               data:
 *                 user:
 *                   id: "ckx123"
 *                   name: "Jane Doe"
 *                   email: "jane@example.com"
 *                   role: "CUSTOMER"
 *                   createdAt: "2026-06-02T12:00:00.000Z"
 *                   updatedAt: "2026-06-02T12:00:00.000Z"
 *                 token: "jwt-token"
 *       409:
 *         description: Duplicate email
 */
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const payload = await registerUser(req.body)
    res.status(201).json(successResponse('User registered successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Login an existing user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             email: "jane@example.com"
 *             password: "password123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: User logged in successfully
 *               data:
 *                 user:
 *                   id: "ckx123"
 *                   name: "Jane Doe"
 *                   email: "jane@example.com"
 *                   role: "CUSTOMER"
 *                   createdAt: "2026-06-02T12:00:00.000Z"
 *                   updatedAt: "2026-06-02T12:00:00.000Z"
 *                 token: "jwt-token"
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const payload = await loginUser(req.body)
    res.json(successResponse('User logged in successfully', payload))
  } catch (error) {
    next(error)
  }
})

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     responses:
 *       200:
 *         description: Current user returned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Current user fetched successfully
 *               data:
 *                 id: "ckx123"
 *                 name: "Jane Doe"
 *                 email: "jane@example.com"
 *                 role: "CUSTOMER"
 *                 createdAt: "2026-06-02T12:00:00.000Z"
 *                 updatedAt: "2026-06-02T12:00:00.000Z"
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/me',
  authenticate,
  async (req, res, next) => {
    try {
      await getCurrentUser(req as AuthenticatedRequest, res)
    } catch (error) {
      next(error)
    }
  },
)

export const authRouter = router
