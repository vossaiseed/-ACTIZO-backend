import { supabase } from '../config/supabase.js'

const TABLE = 'notifications'

export async function findForUser(userId, { from = 0, to = 19 } = {}) {
  const { data, error, count } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('time', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data, count }
}

export async function unreadCount(userId) {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('read', false)
  if (error) throw error
  return count || 0
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw error
  return data
}

export async function markRead(id) {
  const { data, error } = await supabase.from(TABLE).update({ read: true }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from(TABLE)
    .update({ read: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
  if (error) throw error
  return true
}
