import { supabase } from '../config/supabase.js'

const TABLE = 'branches'

export async function findAll({ id, region, status, search, sort = 'created_at', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select('*', { count: 'exact' })
  if (id) query = query.eq('id', id)
  if (region) query = query.eq('region', region)
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,region.ilike.%${search}%,code.ilike.%${search}%`)
  query = query.order(sort, { ascending: order === 'asc' }).range(from, to)
  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function update(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function remove(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
  return true
}

/** Completed sales (amount + date) for a branch — for live monthly trends. */
export async function completedSales(branchId) {
  const { data, error } = await supabase
    .from('sales')
    .select('final_amount, amount, date')
    .eq('branch_id', branchId)
    .eq('status', 'Completed')
  if (error) throw error
  return data || []
}

/** Aggregate counts/revenue scoped to a single branch (live from the data). */
export async function stats(branchId) {
  const map = await bulkStats([branchId])
  return map[branchId] || { staffCount: 0, totalLeads: 0, wonLeads: 0, totalSales: 0, revenue: 0 }
}

/**
 * Aggregate live metrics for many branches at once (3 bulk queries).
 * Returns { [branchId]: { staffCount, totalLeads, wonLeads, totalSales, revenue } }.
 */
export async function bulkStats(branchIds = []) {
  if (!branchIds.length) return {}
  const [staff, leads, sales] = await Promise.all([
    supabase.from('users').select('branch_id').in('branch_id', branchIds).eq('role', 'staff'),
    supabase.from('leads').select('branch_id, status').in('branch_id', branchIds),
    supabase.from('sales').select('branch_id, final_amount, amount, status').in('branch_id', branchIds),
  ])
  if (staff.error) throw staff.error
  if (leads.error) throw leads.error
  if (sales.error) throw sales.error

  const m = {}
  branchIds.forEach((id) => (m[id] = { staffCount: 0, totalLeads: 0, wonLeads: 0, totalSales: 0, revenue: 0 }))
  for (const u of staff.data || []) if (m[u.branch_id]) m[u.branch_id].staffCount += 1
  for (const l of leads.data || []) {
    const e = m[l.branch_id]
    if (!e) continue
    e.totalLeads += 1
    if (l.status === 'Won') e.wonLeads += 1
  }
  for (const s of sales.data || []) {
    const e = m[s.branch_id]
    if (!e || s.status !== 'Completed') continue
    e.totalSales += 1
    e.revenue += Number(s.final_amount ?? s.amount ?? 0)
  }
  return m
}
