import * as targetModel from '../models/target.model.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'
import { TARGET_TYPES } from '../config/constants.js'

const ensureTab = (tab) => {
  if (!TARGET_TYPES.includes(tab)) throw ApiError.badRequest('Invalid target type')
  return tab
}

// camelCase -> snake_case maps per target type
const MAPS = {
  general: { productId: 'product_id', scope: 'scope', branchId: 'branch_id', staffId: 'staff_id', period: 'period', targetQty: 'target_qty', achievedQty: 'achieved_qty', completion: 'completion', startDate: 'start_date', endDate: 'end_date', incentive: 'incentive', threshold: 'threshold', allocations: 'allocations', status: 'status', month: 'month' },
  special: { name: 'name', type: 'type', branchId: 'branch_id', staffId: 'staff_id', startDate: 'start_date', endDate: 'end_date', targetValue: 'target_value', achievedValue: 'achieved_value', incentive: 'incentive', completion: 'completion', status: 'status' },
  project: { name: 'name', type: 'type', location: 'location', projectValue: 'project_value', revenueTarget: 'revenue_target', revenueAchieved: 'revenue_achieved', qtyTarget: 'qty_target', qtyAchieved: 'qty_achieved', branchId: 'branch_id', staffId: 'staff_id', startDate: 'start_date', endDate: 'end_date', completion: 'completion', status: 'status' },
}

function toRow(tab, payload) {
  const map = MAPS[tab]
  const row = {}
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) row[col] = payload[k]
  return row
}

export async function list(tab, query, scope = {}) {
  ensureTab(tab)
  const q = parseListQuery(query)
  const staffScoped = Boolean(scope.staffId) // Staff see ONLY their own targets.
  const { data, count } = await targetModel.findAll(tab, {
    // Manager = their branch + global (null) targets; Staff = only their own; Admin = all/filter.
    branchScope: staffScoped ? null : scope.branchId || null,
    branchId: staffScoped ? null : scope.branchId ? null : query.branch,
    staffId: scope.staffId || query.staff,
    status: query.status,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  let rows = data || []
  if (tab === 'general') {
    // Achievement is ALWAYS computed live from sales (never stored on target edits).
    const sales = await targetModel.completedSalesForAchievement()
    rows = rows.map((t) => withAchievement(t, sales))
  }
  return { data: rows, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(tab, id) {
  ensureTab(tab)
  const row = await targetModel.findById(tab, id)
  if (!row) throw ApiError.notFound('Target not found')
  if (tab === 'general') {
    const sales = await targetModel.completedSalesForAchievement()
    return withAchievement(row, sales)
  }
  return row
}

export async function create(tab, payload) {
  ensureTab(tab)
  return targetModel.create(tab, toRow(tab, payload))
}

export async function update(tab, id, payload) {
  const current = await getById(tab, id)
  // A general target's quantity can only be increased, never reduced once set.
  if (tab === 'general' && payload.targetQty !== undefined && Number(payload.targetQty) < Number(current.target_qty || 0)) {
    throw ApiError.badRequest(`A target can only be increased — current is ${current.target_qty}, cannot lower to ${payload.targetQty}.`)
  }
  return targetModel.update(tab, id, toRow(tab, payload))
}

export async function remove(tab, id) {
  await getById(tab, id)
  return targetModel.remove(tab, id)
}

export async function summary(scope = {}) {
  const branchId = scope.branchId || null
  const staffId = scope.staffId || null
  const sales = await targetModel.completedSalesForAchievement()
  const scoped = { branchScope: staffId ? null : branchId, staffId: staffId || undefined, from: 0, to: 9999 }

  // General targets use LIVE achievement so KPI counts match the displayed records.
  const general = ((await targetModel.findAll('general', scoped)).data || []).map((t) => withAchievement(t, sales))
  const special = (await targetModel.findAll('special', scoped)).data || []
  const project = (await targetModel.findAll('project', scoped)).data || []
  const rows = [...general, ...special, ...project]

  const achieved = rows.filter((r) => ['Completed', 'Overachieved'].includes(r.status)).length
  const overachieved = rows.filter((r) => r.status === 'Overachieved').length
  const pending = rows.filter((r) => ['Pending', 'Active'].includes(r.status)).length
  const avgCompletion = rows.length
    ? Math.round((rows.reduce((s, r) => s + Number(r.completion || 0), 0) / rows.length) * 10) / 10
    : 0
  return { total: rows.length, achieved, pending, overachieved, avgCompletion }
}

/* ================= Hierarchical Target Workflow (Product → Branch → Staff) ================= */

const withinPeriod = (target, date) => {
  if (!target.start_date && !target.end_date) return true
  const day = String(date || '').slice(0, 10)
  if (target.start_date && day < String(target.start_date).slice(0, 10)) return false
  if (target.end_date && day > String(target.end_date).slice(0, 10)) return false
  return true
}

/** Units sold matching a target's product + (branch/staff) scope + period. */
function achievedFor(target, sales) {
  return sales.reduce((sum, s) => {
    if (s.product_id !== target.product_id) return sum
    if (target.branch_id && s.branch_id !== target.branch_id) return sum
    if (target.staff_id && s.staff_id !== target.staff_id) return sum
    if (!withinPeriod(target, s.date)) return sum
    return sum + Number(s.quantity || 0)
  }, 0)
}

/** Overlay LIVE achievement / completion / status / incentive on a general target. */
export function withAchievement(target, sales) {
  const targetQty = Number(target.target_qty || 0)
  const achieved = achievedFor(target, sales)
  const completion = targetQty ? Math.round((achieved / targetQty) * 100) : 0
  const rate = Number(target.incentive || 0) // ₹ per extra unit
  const extraQty = Math.max(0, achieved - targetQty)
  const status = completion > 100 ? 'Overachieved' : completion >= 100 ? 'Completed' : 'Active'
  return {
    ...target,
    achieved_qty: achieved,
    completion,
    status,
    incentive_extra_qty: extraQty,
    incentive_amount: extraQty * rate,
  }
}

/** Admin creates a Product Target (no duplicate for same product + period). */
export async function createProductTarget(payload) {
  if (!payload.productId) throw ApiError.badRequest('Product is required')
  const period = payload.period || 'Monthly'
  const dup = await targetModel.findGeneral({ scope: 'Admin', productId: payload.productId, period })
  if (dup.length) throw ApiError.badRequest('A product target for this product and period already exists')
  return targetModel.createGeneral({
    parent_id: null,
    product_id: payload.productId,
    scope: 'Admin',
    branch_id: null,
    staff_id: null,
    period,
    target_qty: Number(payload.targetQty) || 0,
    start_date: payload.startDate || null,
    end_date: payload.endDate || null,
    incentive: Number(payload.incentiveRate) || 0,
    status: 'Active',
    month: payload.month || null,
  })
}

/** Admin allocates a product target across branches (sum ≤ product target). */
export async function allocateBranches(productTargetId, allocations = []) {
  const pt = await targetModel.findGeneralById(productTargetId)
  if (!pt || pt.scope !== 'Admin') throw ApiError.notFound('Product target not found')
  const valid = allocations.filter((a) => a.branchId && Number(a.targetQty) > 0)
  const total = valid.reduce((s, a) => s + Number(a.targetQty), 0)
  if (total > Number(pt.target_qty || 0)) {
    throw ApiError.badRequest(`Branch allocation total (${total}) exceeds the product target (${pt.target_qty}).`)
  }
  // No-decrease rule: an already-assigned branch target cannot be removed or lowered.
  const currentBranchChildren = await targetModel.findGeneral({ scope: 'Branch', parentId: productTargetId })
  for (const ex of currentBranchChildren) {
    if (Number(ex.target_qty || 0) > 0 && !valid.find((a) => a.branchId === ex.branch_id)) {
      throw ApiError.badRequest(`Targets can only be increased — the ${ex.branch?.name || 'branch'} target cannot be removed or reduced.`)
    }
  }
  const keep = []
  for (const a of valid) {
    const existing = (await targetModel.findGeneral({ scope: 'Branch', parentId: productTargetId, branchId: a.branchId }))[0]
    if (existing) {
      // Targets can only be increased, never reduced once assigned.
      if (Number(a.targetQty) < Number(existing.target_qty || 0)) {
        throw ApiError.badRequest(
          `A branch target can only be increased. Current is ${existing.target_qty}; you cannot lower it to ${a.targetQty}.`,
        )
      }
      await targetModel.updateGeneral(existing.id, { target_qty: Number(a.targetQty) })
      keep.push(existing.id)
    } else {
      const created = await targetModel.createGeneral({
        parent_id: productTargetId, product_id: pt.product_id, scope: 'Branch',
        branch_id: a.branchId, staff_id: null, period: pt.period, target_qty: Number(a.targetQty),
        start_date: pt.start_date, end_date: pt.end_date, incentive: pt.incentive, status: 'Active', month: pt.month,
      })
      keep.push(created.id)
    }
  }
  await targetModel.deleteChildren(productTargetId, keep)
  return targetModel.findGeneral({ parentId: productTargetId })
}

/** Branch Manager allocates their branch target across staff (sum ≤ branch target). */
export async function allocateStaff(branchTargetId, allocations = [], scope = {}) {
  const bt = await targetModel.findGeneralById(branchTargetId)
  if (!bt || bt.scope !== 'Branch') throw ApiError.notFound('Branch target not found')
  if (scope.branchId && bt.branch_id !== scope.branchId) {
    throw ApiError.forbidden('You can only allocate targets within your own branch')
  }
  const valid = allocations.filter((a) => a.staffId && Number(a.targetQty) > 0)
  const total = valid.reduce((s, a) => s + Number(a.targetQty), 0)
  if (total > Number(bt.target_qty || 0)) {
    throw ApiError.badRequest(`Staff allocation total (${total}) exceeds the branch target (${bt.target_qty}).`)
  }
  // No-decrease rule: an already-assigned staff target cannot be removed or lowered.
  const currentStaffChildren = await targetModel.findGeneral({ scope: 'Staff', parentId: branchTargetId })
  for (const ex of currentStaffChildren) {
    if (Number(ex.target_qty || 0) > 0 && !valid.find((a) => a.staffId === ex.staff_id)) {
      throw ApiError.badRequest(`Targets can only be increased — the ${ex.staff?.name || 'staff'} target cannot be removed or reduced.`)
    }
  }
  const keep = []
  for (const a of valid) {
    const existing = (await targetModel.findGeneral({ scope: 'Staff', parentId: branchTargetId, staffId: a.staffId }))[0]
    if (existing) {
      // Targets can only be increased, never reduced once assigned.
      if (Number(a.targetQty) < Number(existing.target_qty || 0)) {
        throw ApiError.badRequest(
          `A staff target can only be increased. Current is ${existing.target_qty}; you cannot lower it to ${a.targetQty}.`,
        )
      }
      await targetModel.updateGeneral(existing.id, { target_qty: Number(a.targetQty) })
      keep.push(existing.id)
    } else {
      const created = await targetModel.createGeneral({
        parent_id: branchTargetId, product_id: bt.product_id, scope: 'Staff',
        branch_id: bt.branch_id, staff_id: a.staffId, period: bt.period, target_qty: Number(a.targetQty),
        start_date: bt.start_date, end_date: bt.end_date, incentive: bt.incentive, status: 'Active', month: bt.month,
      })
      keep.push(created.id)
    }
  }
  await targetModel.deleteChildren(branchTargetId, keep)
  return targetModel.findGeneral({ parentId: branchTargetId })
}
