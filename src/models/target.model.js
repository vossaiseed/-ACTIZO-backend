import { supabase } from '../config/supabase.js'
import { ApiError } from '../utils/ApiError.js'

const TABLES = {
  general: 'general_targets',
  special: 'special_targets',
  project: 'project_targets',
}
const RELATIONS = {
  general: '*, product:products(id,name,unit), branch:branches(id,name), staff:users(id,name,avatar_color)',
  special: '*, branch:branches(id,name), staff:users(id,name)',
  project: '*, branch:branches(id,name), staff:users(id,name)',
}

function table(tab) {
  const t = TABLES[tab]
  if (!t) throw ApiError.badRequest('Invalid target type')
  return t
}

export async function findAll(tab, { branchScope, branchId, staffId, status, search, sort = 'created_at', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(table(tab)).select(RELATIONS[tab], { count: 'exact' })
  if (branchScope) {
    // Branch managers see their branch's targets AND global / all-branch (admin) targets.
    query = query.or(`branch_id.eq.${branchScope},branch_id.is.null`)
  } else if (branchId) {
    query = query.eq('branch_id', branchId)
  }
  if (staffId) query = query.eq('staff_id', staffId)
  if (status) query = query.eq('status', status)
  if (search && tab !== 'general') query = query.ilike('name', `%${search}%`)
  query = query.order(sort, { ascending: order === 'asc' }).range(from, to)
  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function findById(tab, id) {
  const { data, error } = await supabase.from(table(tab)).select(RELATIONS[tab]).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function create(tab, payload) {
  const { data, error } = await supabase.from(table(tab)).insert(payload).select(RELATIONS[tab]).single()
  if (error) throw error
  return data
}

export async function update(tab, id, payload) {
  const { data, error } = await supabase.from(table(tab)).update(payload).eq('id', id).select(RELATIONS[tab]).single()
  if (error) throw error
  return data
}

export async function remove(tab, id) {
  const { error } = await supabase.from(table(tab)).delete().eq('id', id)
  if (error) throw error
  return true
}

/* ---- General-target hierarchy (Product -> Branch -> Staff) ---- */
const GEN = 'general_targets'
const GEN_REL = '*, product:products(id,name,unit), branch:branches(id,name), staff:users(id,name,avatar_color)'

/** Flexible query over general_targets (raw snake_case filters). */
export async function findGeneral({ scope, productId, period, branchId, staffId, parentId } = {}) {
  let q = supabase.from(GEN).select(GEN_REL)
  if (scope) q = q.eq('scope', scope)
  if (productId) q = q.eq('product_id', productId)
  if (period) q = q.eq('period', period)
  if (branchId) q = q.eq('branch_id', branchId)
  if (staffId) q = q.eq('staff_id', staffId)
  if (parentId) q = q.eq('parent_id', parentId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function findGeneralById(id) {
  const { data, error } = await supabase.from(GEN).select(GEN_REL).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** Raw insert (keeps parent_id / snake_case columns the camelCase mapper drops). */
export async function createGeneral(row) {
  const { data, error } = await supabase.from(GEN).insert(row).select(GEN_REL).single()
  if (error) throw error
  return data
}

export async function updateGeneral(id, row) {
  const { data, error } = await supabase.from(GEN).update(row).eq('id', id).select(GEN_REL).single()
  if (error) throw error
  return data
}

/** Delete child allocations of a parent, except the ids we just kept/updated. */
export async function deleteChildren(parentId, exceptIds = []) {
  let q = supabase.from(GEN).delete().eq('parent_id', parentId)
  if (exceptIds.length) q = q.not('id', 'in', `(${exceptIds.join(',')})`)
  const { error } = await q
  if (error) throw error
}

/** Completed sales for live target achievement. */
export async function completedSalesForAchievement() {
  const { data, error } = await supabase
    .from('sales')
    .select('product_id, branch_id, staff_id, quantity, date, status')
    .eq('status', 'Completed')
  if (error) throw error
  return data || []
}

/** completion + status across all three target tables for the summary KPIs. */
export async function summaryRows(branchScope) {
  // Branch managers' KPIs reflect their branch + global targets (match the list).
  const sel = (t) => {
    let q = supabase.from(t).select('completion,status')
    if (branchScope) q = q.or(`branch_id.eq.${branchScope},branch_id.is.null`)
    return q
  }
  const [g, s, p] = await Promise.all([
    sel('general_targets'),
    sel('special_targets'),
    sel('project_targets'),
  ])
  for (const r of [g, s, p]) if (r.error) throw r.error
  return [...(g.data || []), ...(s.data || []), ...(p.data || [])]
}
