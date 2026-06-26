import { supabase } from '../config/supabase.js'

const TABLE = 'products'

export async function findAll({ category, status, search, sort = 'created_at', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select('*', { count: 'exact' })
  if (category) query = query.eq('category', category)
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,brand.ilike.%${search}%`)
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

/* ---- Related collections ---- */
export async function salesHistory(productId) {
  const { data, error } = await supabase
    .from('sales')
    .select('id,ref_code,customer,branch_id,quantity,unit,amount,date,status, branch:branches(name)')
    .eq('product_id', productId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}
