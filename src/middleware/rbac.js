import { ApiError } from '../utils/ApiError.js'
import { ROLES } from '../config/constants.js'

/**
 * Restrict a route to one or more roles.
 *   router.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), handler)
 */
export const authorize =
  (...allowed) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!allowed.length || allowed.includes(req.user.role)) return next()
    return next(ApiError.forbidden('You do not have permission to perform this action'))
  }

export const adminOnly = authorize(ROLES.ADMIN)
export const adminOrManager = authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER)

/**
 * Branch scoping helper — Branch Managers & Staff are limited to their own
 * branch. Admins are unrestricted. Returns the branchId to filter by, or null
 * for unrestricted access.
 */
export function branchScope(req) {
  if (!req.user) return null
  if (req.user.role === ROLES.ADMIN) return null
  return req.user.branchId || null
}

/**
 * Build a consistent data-access scope for list/stats endpoints:
 *   - Admin            -> {} (unrestricted)
 *   - Branch Manager   -> { branchId }            (their branch only)
 *   - Sales Staff      -> { branchId, staffId }   (their own records only)
 */
export function requestScope(req) {
  if (!req.user || req.user.role === ROLES.ADMIN) return {}
  const scope = { branchId: req.user.branchId || null }
  if (req.user.role === ROLES.STAFF) scope.staffId = req.user.id
  return scope
}

export default authorize
