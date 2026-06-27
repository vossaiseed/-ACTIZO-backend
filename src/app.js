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

// CORS — tolerant of trailing slashes + comma-separated multiple origins.
// (A trailing slash in CORS_ORIGIN is the classic "data not showing in prod" bug:
//  browsers send Origin with no trailing slash, so an exact-string match fails.)
const stripSlash = (s) => String(s || '').trim().replace(/\/+$/, '')
const allowedOrigins = stripSlash(env.corsOrigin) === '*'
  ? ['*']
  : env.corsOrigin.split(',').map(stripSlash).filter(Boolean)
const corsOptions = {
  origin(origin, cb) {
    // Allow non-browser clients (no Origin), wildcard, or a normalized match.
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(stripSlash(origin))) {
      return cb(null, true)
    }
    return cb(null, false)
  },
  credentials: true,
}

// Security & parsing
app.use(helmet())
app.use(cors(corsOptions))
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
