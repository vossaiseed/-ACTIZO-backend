import { supabase } from '../config/supabase.js'
import * as notificationModel from '../models/notification.model.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

export async function list(userId, query) {
  const q = parseListQuery(query, { defaultSort: 'time' })
  const { data, count } = await notificationModel.findForUser(userId, { from: q.from, to: q.to })
  const unread = await notificationModel.unreadCount(userId)
  return { data, meta: { ...buildMeta({ page: q.page, limit: q.limit, total: count }), unread } }
}

export async function create(payload) {
  return notificationModel.create({
    user_id: payload.userId || null,
    type: payload.type,
    title: payload.title,
    message: payload.message,
  })
}

/**
 * Resolve who should receive an event, scoped by role + branch:
 *   - all active Admins (system-wide visibility)
 *   - the active Branch Manager(s) of the event's branch
 *   - the owning staff / explicit user
 * Users from other branches are never included.
 */
async function recipientsFor({ branchId = null, staffId = null, userId = null }) {
  const ids = new Set()
  const { data: admins } = await supabase
    .from('users').select('id').eq('role', 'admin').eq('status', 'active')
  for (const a of admins || []) ids.add(a.id)
  if (branchId) {
    const { data: mgrs } = await supabase
      .from('users').select('id').eq('role', 'branch_manager').eq('branch_id', branchId).eq('status', 'active')
    for (const m of mgrs || []) ids.add(m.id)
  }
  if (staffId) ids.add(staffId)
  if (userId) ids.add(userId)
  return [...ids]
}

/**
 * Fire-and-forget emit used by other services on business events.
 * Never throws — a notification failure must not break the main operation.
 * Creates exactly one row per resolved recipient (no broadcast, no cross-branch
 * leak, no duplicates).
 */
export async function emit({ userId = null, branchId = null, staffId = null, type, title, message }) {
  try {
    const recipients = await recipientsFor({ branchId, staffId, userId })
    if (!recipients.length) return null
    return await notificationModel.createMany(
      recipients.map((id) => ({ user_id: id, type, title, message })),
    )
  } catch {
    return null
  }
}

export async function markRead(id) {
  return notificationModel.markRead(id)
}

export async function markAllRead(userId) {
  return notificationModel.markAllRead(userId)
}
