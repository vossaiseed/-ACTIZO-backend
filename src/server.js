import app from './app.js'
import { env, validateEnv } from './config/env.js'
import { logger } from './utils/logger.js'

validateEnv()

const server = app.listen(env.port, () => {
  logger.success(`ACTIZO CRM API running at http://localhost:${env.port}${env.apiPrefix}`)
  logger.info(`Environment: ${env.nodeEnv}`)
})

// Graceful shutdown
const shutdown = (signal) => {
  logger.warn(`${signal} received — shutting down...`)
  server.close(() => {
    logger.info('Server closed.')
    process.exit(0)
  })
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection:', reason))

export default server
