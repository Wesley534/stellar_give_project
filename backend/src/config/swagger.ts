import path from 'path'

import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import { env } from './env'

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'GIVE Invoice Finance API',
      version: '1.0.0',
      description: 'Authentication and user APIs for the invoice financing MVP.',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'Protected user endpoints' },
      { name: 'Health', description: 'Health and readiness checks' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(process.cwd(), 'src/**/*.ts')],
})

export const swaggerDocs = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
}
