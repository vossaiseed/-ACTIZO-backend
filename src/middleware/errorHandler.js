import { ApiError } from '../utils/ApiError.js'
import { logger } from '../utils/logger.js'
import { env } from '../config/env.js'

/* 404 handler for unmatched routes. */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))
}

/* Centralized error handler. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'
  const details = err.details || null

  // Map common Supabase / Postgres errors to friendlier responses.
  if (err.code === '23505') {
    statusCode = 409
    message = 'A record with these details already exists'
  } else if (err.code === '23503') {
    statusCode = 400
    message = 'Referenced record does not exist'
  }

  if (statusCode >= 500) logger.error(err)

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  })
}

export default errorHandler
