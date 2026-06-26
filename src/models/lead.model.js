import { supabase } from '../config/supabase.js'

const TABLE = 'leads'
const RELATIONS = '*, product:products(id,name,unit,category), branch:branches(id,name), staff:users(id,name)'

export async function findAll({ status, branchId, staffId, source, priority, search, sort = 'created_at', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select(RELATIONS, { count: 'exact' })
  if (status) query = query.eq('status', status)
  if (branchId) query = query.eq('branch_id', branchId)
  if (staffId) query = query.eq('staff_id', staffId)
  if (source) query = query.eq('source', source)
  if (priority) query = query.eq('priority', priority)
  if (search) query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%,ref_code.ilike.%${search}%`)
  query = query.order(sort, { ascending: order === 'asc' }).range(from, to)
  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select(RELATIONS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select(RELATIONS).single()
  if (error) throw error
  return data
}

export async function update(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select(RELATIONS).single()
  if (error) throw error
  return data
}

export async function remove(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
  return true
}

export async function countByStatus() {
  const { data, error } = await supabase.from(TABLE).select('status')
  if (error) throw error
  return (data || []).reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {})
}

/* ---- Related collections ---- */
export async function getTimeline(leadId) {
  const { data, error } = await supabase.from('lead_timeline').select('*').eq('lead_id', leadId).order('date', { ascending: true })
  if (error) throw error
  return data
}
export async function addTimeline(entry) {
  const { data, error } = await supabase.from('lead_timeline').insert(entry).select().single()
  if (error) throw error
  return data
}
export async function getActivities(leadId) {
  const { data, error } = await supabase.from('lead_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export async function addActivity(entry) {
  const { data, error } = await supabase.from('lead_activities').insert(entry).select().single()
  if (error) throw error
  return data
}
export async function getFollowUps(leadId) {
  const { data, error } = await supabase.from('follow_ups').select('*').eq('lead_id', leadId).order('date', { ascending: false })
  if (error) throw error
  return data
}
