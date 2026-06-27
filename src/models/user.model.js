import { supabase } from '../config/supabase.js'

const TABLE = 'users'
// Never leak the PIN hash to API responses.
const PUBLIC = 'id, employee_id, name, email, phone, role, pin, branch_id, avatar_color, status, assigned_leads, won_leads, conversion_rate, revenue, target, achievement, incentive_earned, performance_score, rating, join_date, last_login, created_at, updated_at'

export async function findAll({ role, branchId, status, search, sort = 'created_at', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select(PUBLIC, { count: 'exact' })
  if (role) query = query.eq('role', role)
  if (branchId) query = query.eq('branch_id', branchId)
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`)
  query = query.order(sort, { ascending: order === 'asc' }).range(from, to)
  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function findById(id) {
  // includes pin_hash for internal auth use
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function findPublicById(id) {
  const { data, error } = await supabase.from(TABLE).select(PUBLIC).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function findByEmail(email) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('email', email).maybeSingle()
  if (error) throw error
  return data
}

export async function findByEmployeeId(employeeId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('employee_id', employeeId).maybeSingle()
  if (error) throw error
  return data
}

/** Active users of a given role — used by role+PIN login. */
export async function findActiveByRole(role) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('role', role).eq('status', 'active')
  if (error) throw error
  return data || []
}

/** Users that currently hold a given plaintext PIN — used to enforce PIN uniqueness. */
export async function findByPin(pin) {
  const { data, error } = await supabase.from(TABLE).select('id, name, role, status').eq('pin', pin)
  if (error) throw error
  return data || []
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select(PUBLIC).single()
  if (error) throw error
  return data
}

export async function update(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select(PUBLIC).single()
  if (error) throw error
  return data
}

export async function remove(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
  return true
}

export async function touchLastLogin(id) {
  await supabase.from(TABLE).update({ last_login: new Date().toISOString() }).eq('id', id)
}
