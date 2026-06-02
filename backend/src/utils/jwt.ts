import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'

import { env } from '../config/env'

type JwtPayload = {
  sub: string
  email: string
  role: string
}

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET as Secret, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  })
}

export function verifyJwt(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}
