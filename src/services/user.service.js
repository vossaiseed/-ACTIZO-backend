import * as userModel from '../models/user.model.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'
import { hashPin, generatePin } from '../utils/pin.js'
import { ROLES } from '../config/constants.js'

export async function list(query, scope = {}) {
  const q = parseListQuery(query)
  const { data, count } = await userModel.findAll({
    role: query.role,
    branchId: scope.branchId || query.branch,
    status: query.status,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  return { data, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id) {
  const user = await userModel.findPublicById(id)
  if (!user) throw ApiError.notFound('User not found')
  return user
}

/**
 * Guarantee a PIN is unique across users so role+PIN login always resolves to ONE
 * account. If `provided` is given, reject collisions; otherwise generate a fresh
 * unique PIN. (Inactive accounts are ignored — they can't log in.)
 */
async function ensureUniquePin(provided, exceptId = null) {
  const clashes = async (pin) => {
    const matches = await userModel.findByPin(pin)
    return matches.some((u) => u.id !== exceptId && u.status === 'active')
  }
  if (provided) {
    if (await clashes(provided)) {
      throw ApiError.badRequest(`PIN ${provided} is already in use. Please choose a different 6-digit PIN.`)
    }
    return provided
  }
  for (let i = 0; i < 25; i += 1) {
    const pin = generatePin()
    // eslint-disable-next-line no-await-in-loop
    if (!(await clashes(pin))) return pin
  }
  throw ApiError.badRequest('Could not allocate a unique PIN. Please try again.')
}

export async function create(payload, actor = {}) {
  const role = payload.role || 'staff'
  if (![ROLES.STAFF, ROLES.BRANCH_MANAGER, ROLES.ADMIN].includes(role)) {
    throw ApiError.badRequest('Invalid role')
  }
  if (role === ROLES.ADMIN && actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an admin can create admin users')
  }
  // Branch managers can only create users within their own branch.
  const branchId =
    actor.role === ROLES.BRANCH_MANAGER ? actor.branchId : payload.branchId || null

  const pin = await ensureUniquePin(payload.pin) // unique, or generate a unique one
  const pin_hash = await hashPin(pin)

  const created = await userModel.create({
    employee_id: payload.employeeId || null,
    name: payload.name,
    email: payload.email || null,
    phone: payload.phone || null,
    role,
    pin_hash,
    pin,
    branch_id: branchId,
    avatar_color: payload.avatarColor || 'from-emerald-400 to-emerald-600',
    status: payload.status || 'active',
  })
  return { ...created, pin }
}

export async function update(id, payload) {
  await getById(id)
  const fields = {}
  const map = {
    name: 'name', email: 'email', phone: 'phone', role: 'role',
    branchId: 'branch_id', status: 'status', employeeId: 'employee_id', avatarColor: 'avatar_color',
  }
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) fields[col] = payload[k]
  if (payload.pin) {
    const pin = await ensureUniquePin(payload.pin, id)
    fields.pin_hash = await hashPin(pin)
    fields.pin = pin
  }
  return userModel.update(id, fields)
}

export async function setStatus(id, status) {
  await getById(id)
  if (!['active', 'inactive'].includes(status)) throw ApiError.badRequest('Invalid status')
  return userModel.update(id, { status })
}

export async function resetPin(id) {
  await getById(id)
  const pin = await ensureUniquePin(null, id) // fresh, guaranteed-unique PIN
  await userModel.update(id, { pin_hash: await hashPin(pin), pin })
  return { pin }
}

export async function remove(id) {
  await getById(id)
  return userModel.remove(id)
}
