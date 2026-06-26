import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'

import { env } from './config/env.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import routes from './routes/index.js'

const app = express()

// Security & parsing
app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())
if (!env.isProd) app.use(morgan('dev'))

// Health check
app.get('/health', (_req, res) =>
  res.json({ success: true, message: 'ACTIZO CRM API is healthy', timestamp: new Date().toISOString() }),
)

// API routes
app.use(env.apiPrefix, apiLimiter, routes)

// 404 + error handling
app.use(notFound)
app.use(errorHandler)

export default app
