import { supabase } from '../config/supabase.js'

const TABLE = 'target_requests'
// Two FKs point at users (requested_by, resolved_by) — disambiguate by column.
const REL =
  '*, branch:branches(id,name), product:products(id,name,unit), requester:users!requested_by(id,name,avatar_color)'

export async function findAll({ branchId, requestedBy, status } = {}) {
  let q = supabase.from(TABLE).select(REL).order('created_at', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  if (requestedBy) q = q.eq('requested_by', requestedBy)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select(REL).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function create(row) {
  const { data, error } = await supabase.from(TABLE).insert(row).select(REL).single()
  if (error) throw error
  return data
}

export async function update(id, row) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(REL)
    .single()
  if (error) throw error
  return data
}
