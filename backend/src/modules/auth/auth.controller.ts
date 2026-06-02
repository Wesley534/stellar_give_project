import { Response } from 'express'

import { AuthenticatedRequest } from '../../middlewares/auth.middleware'
import { AppError } from '../../middlewares/error.middleware'
import { successResponse } from '../../utils/api-response'
import { findUserById } from '../users/user.service'

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  const user = await findUserById(req.user.id)

  if (!user) {
    throw new AppError('User not found', 404)
  }

  res.json(successResponse('Current user fetched successfully', user))
}
