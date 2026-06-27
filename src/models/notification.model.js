import { supabase } from '../config/supabase.js'

const TABLE = 'notifications'

// Users only ever see notifications explicitly addressed to them — no broadcast
// rows — so a manager/staff can never see another branch's notifications.
export async function findForUser(userId, { from = 0, to = 19 } = {}) {
  const { data, error, count } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('time', { ascending: false })
    .range(from, to)
  if (error) throw error
  return { data, count }
}

export async function unreadCount(userId) {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
  return count || 0
}

export async function create(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw error
  return data
}

/** Bulk insert one notification per recipient (scoped fan-out). */
export async function createMany(rows) {
  if (!rows.length) return []
  const { data, error } = await supabase.from(TABLE).insert(rows).select()
  if (error) throw error
  return data || []
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
    .eq('user_id', userId)
  if (error) throw error
  return true
}
