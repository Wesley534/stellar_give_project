declare module 'swagger-jsdoc' {
  const swaggerJSDoc: (options: unknown) => object
  export default swaggerJSDoc
}

declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express'

  const swaggerUi: {
    serve: RequestHandler[]
    setup: (document: object, options?: unknown) => RequestHandler
  }

  export default swaggerUi
}
