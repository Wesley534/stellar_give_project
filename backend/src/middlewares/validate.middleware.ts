import { NextFunction, Request, Response } from 'express'
import { ZodTypeAny } from 'zod'

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    })

    next()
  }
}
