import { verifyAccessToken } from '../utils/jwt.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import * as userModel from '../models/user.model.js'

/**
 * Require a valid Bearer access token. Attaches `req.user` with the live
 * user record (so deactivated users are rejected immediately).
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw ApiError.unauthorized('Authentication token is required')

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    throw ApiError.unauthorized('Invalid or expired token')
  }

  const user = await userModel.findById(payload.sub)
  if (!user) throw ApiError.unauthorized('User no longer exists')
  if (user.status && user.status !== 'active') throw ApiError.forbidden('Account is inactive')

  req.user = {
    id: user.id,
    role: user.role,
    branchId: user.branch_id,
    name: user.name,
    email: user.email,
  }
  next()
})

/** Optional auth — attaches req.user if a valid token is present, else continues. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try {
      const payload = verifyAccessToken(token)
      const user = await userModel.findById(payload.sub)
      if (user) req.user = { id: user.id, role: user.role, branchId: user.branch_id }
    } catch {
      /* ignore */
    }
  }
  next()
})

export default authenticate
