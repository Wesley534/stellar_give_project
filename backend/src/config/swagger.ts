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
      description: 'API surface for the GIVE Stellar invoice financing liquidity pool MVP.',
    },
    servers: [
      {
        url: `https://stellar-give-project.onrender.com:${env.PORT}`,
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'Protected user endpoints' },
      { name: 'Wallets', description: 'Freighter wallet connection endpoints' },
      { name: 'Pool', description: 'Liquidity pool operations and investor positions' },
      { name: 'Financing', description: 'Invoice financing lifecycle endpoints' },
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
