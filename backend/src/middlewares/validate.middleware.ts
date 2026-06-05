import { NextFunction, Request, Response } from 'express'
import { ZodTypeAny } from 'zod'

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    }) as {
      body: Request['body']
      params: Request['params']
      query: Request['query']
    }

    req.body = parsed.body
    req.params = parsed.params

    next()
  }
}
