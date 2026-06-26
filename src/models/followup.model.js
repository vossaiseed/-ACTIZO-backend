import { supabase } from '../config/supabase.js'

const TABLE = 'follow_ups'
const RELATIONS = '*, lead:leads(id,ref_code,name,product_id,branch_id,staff_id)'
// When scoping by the lead's branch/staff we need an inner join to filter on it.
const RELATIONS_INNER = '*, lead:leads!inner(id,ref_code,name,product_id,branch_id,staff_id)'

export async function findAll({ status, type, leadId, branchId, staffId, search, sort = 'date', order = 'desc', from = 0, to = 9 } = {}) {
  const scoped = Boolean(branchId || staffId)
  let query = supabase.from(TABLE).select(scoped ? RELATIONS_INNER : RELATIONS, { count: 'exact' })
  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)
  if (leadId) query = query.eq('lead_id', leadId)
  if (branchId) query = query.eq('lead.branch_id', branchId)
  if (staffId) query = query.eq('lead.staff_id', staffId)
  if (search) query = query.ilike('remark', `%${search}%`)
  query = query.order(sort, { ascending: order === 'asc' }).range(from, to)
  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function findByLead(leadId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('lead_id', leadId).order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function update(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function remove(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
  return true
}

export async function upcoming(limit = 8, { branchId, staffId } = {}) {
  const scoped = Boolean(branchId || staffId)
  let query = supabase
    .from(TABLE)
    .select(scoped ? RELATIONS_INNER : RELATIONS)
    .eq('status', 'Scheduled')
  if (branchId) query = query.eq('lead.branch_id', branchId)
  if (staffId) query = query.eq('lead.staff_id', staffId)
  query = query.order('next_date', { ascending: true }).limit(limit)
  const { data, error } = await query
  if (error) throw error
  return data
}
