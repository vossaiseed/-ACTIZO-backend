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
 * Fire-and-forget emit used by other services on business events.
 * Never throws — a notification failure must not break the main operation.
 * userId = null broadcasts to everyone (the model returns null-targeted rows too).
 */
export async function emit({ userId = null, type, title, message }) {
  try {
    return await notificationModel.create({ user_id: userId, type, title, message })
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
