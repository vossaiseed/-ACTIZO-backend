import { supabase } from '../config/supabase.js'

const TABLE = 'incentives'
const RELATIONS = '*, staff:users(id,name,avatar_color), branch:branches(id,name)'

export async function findAll({ staffId, branchId, status, type, month, sort = 'total', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select(RELATIONS, { count: 'exact' })
  if (staffId) query = query.eq('staff_id', staffId)
  if (branchId) query = query.eq('branch_id', branchId)
  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)
  if (month) query = query.eq('month', month)
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

export async function allWithStaff({ branchId, staffId } = {}) {
  let query = supabase.from(TABLE).select('total, month, staff:users(id,name,avatar_color)')
  if (branchId) query = query.eq('branch_id', branchId)
  if (staffId) query = query.eq('staff_id', staffId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}
