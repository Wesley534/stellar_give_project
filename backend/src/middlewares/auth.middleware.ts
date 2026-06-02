import { NextFunction, Request, Response } from 'express'
import { Role } from '@prisma/client'

import { prisma } from '../config/prisma'
import { AppError } from './error.middleware'
import { verifyJwt } from '../utils/jwt'

export type AuthenticatedRequest = Request & {
  user: {
    id: string
    email: string
    role: Role
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization

    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Authentication token is missing', 401)
    }

    const token = header.split(' ')[1]
    const payload = verifyJwt(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    })

    if (!user) {
      throw new AppError('User not found', 401)
    }

    ;(req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
    }

    next()
  } catch (error) {
    next(error)
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest

    if (!authReq.user) {
      return next(new AppError('Authentication required', 401))
    }

    if (roles.length > 0 && !roles.includes(authReq.user.role)) {
      return next(new AppError('Forbidden', 403))
    }

    return next()
  }
}
