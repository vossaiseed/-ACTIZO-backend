import { supabase } from '../config/supabase.js'

const TABLE = 'sales'
const RELATIONS = '*, product:products(id,name,unit), branch:branches(id,name), staff:users(id,name)'

export async function findAll({ branchId, staffId, productId, status, search, sort = 'date', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select(RELATIONS, { count: 'exact' })
  if (branchId) query = query.eq('branch_id', branchId)
  if (staffId) query = query.eq('staff_id', staffId)
  if (productId) query = query.eq('product_id', productId)
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`customer.ilike.%${search}%,ref_code.ilike.%${search}%`)
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

/** Raw rows for stats aggregation, with product/branch labels (branch/staff scoped). */
export async function aggregate({ branchId, staffId } = {}) {
  let query = supabase
    .from(TABLE)
    .select('amount, status, date, quantity, product:products(name), branch:branches(name)')
  if (branchId) query = query.eq('branch_id', branchId)
  if (staffId) query = query.eq('staff_id', staffId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}
