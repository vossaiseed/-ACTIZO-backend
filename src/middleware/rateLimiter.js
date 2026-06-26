import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

// Rate limiting is only meaningful in production. In development the SPA fires
// many requests per page (×2 under React StrictMode) which trips the limiter
// during normal testing, so we skip it locally.
const skipInDev = () => !env.isProd

export const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: { success: false, message: 'Too many requests, please try again later.' },
})

/* Stricter limiter for auth endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
})

export default apiLimiter
