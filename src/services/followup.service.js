import * as followupModel from '../models/followup.model.js'
import * as leadModel from '../models/lead.model.js'
import { ApiError } from '../utils/ApiError.js'
import { assertScopeAccess } from '../middleware/rbac.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

export async function list(query, scope = {}) {
  const q = parseListQuery(query, { defaultSort: 'date' })
  const { data, count } = await followupModel.findAll({
    status: query.status,
    type: query.type,
    leadId: query.lead,
    branchId: scope.branchId,
    staffId: scope.staffId,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  return { data, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function upcoming(limit = 8, scope = {}) {
  return followupModel.upcoming(limit, { branchId: scope.branchId, staffId: scope.staffId })
}

export async function create(payload, actor = 'Sales', scope = {}) {
  if (!payload.leadId) throw ApiError.badRequest('leadId is required')
  const lead = await leadModel.findById(payload.leadId)
  if (!lead) throw ApiError.notFound('Lead not found')
  assertScopeAccess(scope, { branchId: lead.branch_id, staffId: lead.staff_id })
  const followUp = await followupModel.create({
    lead_id: payload.leadId,
    type: payload.type,
    status: payload.status || 'Scheduled',
    date: payload.date || new Date().toISOString().slice(0, 10),
    next_date: payload.nextDate || null,
    remark: payload.remark || '',
    by: payload.by || actor,
  })
  await leadModel.addActivity({
    lead_id: payload.leadId,
    action: `Follow-up (${payload.type})`,
    detail: payload.remark,
    date: payload.date || new Date().toISOString().slice(0, 10),
    by: payload.by || actor,
  })
  await leadModel.update(payload.leadId, {
    next_follow_up: payload.nextDate || null,
    last_activity: new Date().toISOString(),
  })
  return followUp
}

export async function update(id, payload, scope = {}) {
  const existing = await followupModel.findById(id)
  if (!existing) throw ApiError.notFound('Follow-up not found')
  assertScopeAccess(scope, { branchId: existing.lead?.branch_id, staffId: existing.lead?.staff_id })
  const fields = {}
  const map = { type: 'type', status: 'status', date: 'date', nextDate: 'next_date', remark: 'remark', by: 'by' }
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) fields[col] = payload[k]
  return followupModel.update(id, fields)
}

export async function remove(id, scope = {}) {
  const existing = await followupModel.findById(id)
  if (!existing) throw ApiError.notFound('Follow-up not found')
  assertScopeAccess(scope, { branchId: existing.lead?.branch_id, staffId: existing.lead?.staff_id })
  return followupModel.remove(id)
}
