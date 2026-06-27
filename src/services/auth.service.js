import { supabase } from '../config/supabase.js'
import * as userModel from '../models/user.model.js'
import { verifyPin } from '../utils/pin.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
import { ApiError } from '../utils/ApiError.js'
import { ROLE_VALUES, ROLE_PERMISSIONS } from '../config/constants.js'

const toSession = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  branchId: u.branch_id,
  avatarColor: u.avatar_color,
  permissions: ROLE_PERMISSIONS[u.role] || [],
})

/** Resolve the assigned branch name so the UI shows the real branch (not a placeholder). */
async function withBranchName(session) {
  if (session.branchId) {
    const { data } = await supabase.from('branches').select('name').eq('id', session.branchId).maybeSingle()
    session.branchName = data?.name || null
  } else {
    session.branchName = null
  }
  return session
}

/**
 * Role + 6-digit PIN login (mirrors the frontend). Optionally an identifier
 * (employeeId/email) can pin the login to a specific account.
 */
export async function login({ role, pin, identifier }) {
  if (!ROLE_VALUES.includes(role)) throw ApiError.badRequest('Invalid role')

  let candidate = null
  if (identifier) {
    candidate =
      (await userModel.findByEmployeeId(identifier)) || (await userModel.findByEmail(identifier))
    if (!candidate || candidate.role !== role) throw ApiError.unauthorized('Invalid credentials')
    if (!(await verifyPin(pin, candidate.pin_hash))) throw ApiError.unauthorized('Invalid PIN')
  } else {
    const users = await userModel.findActiveByRole(role)
    for (const u of users) {
      // eslint-disable-next-line no-await-in-loop
      if (await verifyPin(pin, u.pin_hash)) {
        candidate = u
        break
      }
    }
    if (!candidate) throw ApiError.unauthorized('Invalid PIN for the selected role')
  }

  if (candidate.status !== 'active') throw ApiError.forbidden('Account is inactive')

  await userModel.touchLastLogin(candidate.id)
  const session = await withBranchName(toSession(candidate))
  return {
    user: session,
    accessToken: signAccessToken({ sub: candidate.id, role: candidate.role }),
    refreshToken: signRefreshToken({ sub: candidate.id }),
  }
}

export async function getProfile(userId) {
  const user = await userModel.findPublicById(userId)
  if (!user) throw ApiError.notFound('User not found')
  return withBranchName({ ...user, ...toSession(user) })
}

export async function refresh(refreshToken) {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw ApiError.unauthorized('Invalid refresh token')
  }
  const user = await userModel.findById(payload.sub)
  if (!user || user.status !== 'active') throw ApiError.unauthorized('User not available')
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id }),
  }
}
