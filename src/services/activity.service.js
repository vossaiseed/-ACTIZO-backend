import * as activityModel from '../models/activity.model.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

export async function list(query) {
  const q = parseListQuery(query, { defaultSort: 'time' })
  const { data, count } = await activityModel.findAll({
    type: query.type,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  return { data, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function create(payload) {
  return activityModel.create({
    type: payload.type,
    icon: payload.icon,
    color: payload.color,
    title: payload.title,
    description: payload.description,
    user_id: payload.userId || null,
  })
}

/** Fire-and-forget helper other services can use to record activity. */
export async function log(entry) {
  try {
    await activityModel.create(entry)
  } catch {
    /* best-effort */
  }
}
