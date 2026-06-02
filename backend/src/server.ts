import { app } from './app'
import { env } from './config/env'
import { prisma } from './config/prisma'

async function startServer() {
  try {
    await prisma.$connect()

    app.listen(env.PORT, () => {
      console.log(`Backend listening on http://localhost:${env.PORT}`)
      console.log(`Swagger UI available at http://localhost:${env.PORT}/api-docs`)
    })
  } catch (error) {
    console.error('Failed to start server', error)
    process.exit(1)
  }
}

void startServer()
