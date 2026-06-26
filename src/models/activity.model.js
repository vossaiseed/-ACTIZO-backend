import { supabase } from '../config/supabase.js'

const TABLE = 'activities'
const RELATIONS = '*, user:users(id,name,avatar_color)'

export async function findAll({ type, search, sort = 'time', order = 'desc', from = 0, to = 9 } = {}) {
  let query = supabase.from(TABLE).select(RELATIONS, { count: 'exact' })
  if (type) query = query.eq('type', type)
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  query = query.order(sort, { ascending: order === 'asc' }).range(from, to)
  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select(RELATIONS).single()
  if (error) throw error
  return data
}
