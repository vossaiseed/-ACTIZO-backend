import * as leadModel from '../models/lead.model.js'
import * as followupModel from '../models/followup.model.js'
import * as branchModel from '../models/branch.model.js'
import * as notificationService from './notification.service.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'
import { LEAD_STATUSES } from '../config/constants.js'

const today = () => new Date().toISOString().slice(0, 10)
const refCode = () => `LD-${Date.now().toString().slice(-7)}`

// Map customer locations (incl. aliases) to a branch city so leads auto-route.
const LOCATION_TO_BRANCH = {
  calicut: 'kozhikode', kozhikode: 'kozhikode',
  malappuram: 'malappuram',
  kochi: 'kochi', cochin: 'kochi', ernakulam: 'kochi',
  thrissur: 'thrissur',
  coimbatore: 'coimbatore',
}

/** Resolve the branch id from a customer location string (server-side enforced). */
async function resolveBranchFromLocation(location) {
  if (!location) return null
  const key = String(location).trim().toLowerCase()
  let target = LOCATION_TO_BRANCH[key]
  if (!target) {
    for (const [alias, city] of Object.entries(LOCATION_TO_BRANCH)) {
      if (key.includes(alias)) { target = city; break }
    }
  }
  if (!target) return null
  const { data } = await branchModel.findAll({ from: 0, to: 99 })
  const branch = (data || []).find(
    (b) => (b.city || '').toLowerCase() === target || (b.name || '').toLowerCase() === target,
  )
  return branch?.id || null
}

export async function list(query, scope = {}) {
  const q = parseListQuery(query)
  const { data, count } = await leadModel.findAll({
    status: query.status,
    branchId: scope.branchId || query.branch,
    staffId: scope.staffId || query.staff,
    source: query.source,
    priority: query.priority,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  return { data, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id) {
  const lead = await leadModel.findById(id)
  if (!lead) throw ApiError.notFound('Lead not found')
  const [timeline, followUps, activities] = await Promise.all([
    leadModel.getTimeline(id),
    leadModel.getFollowUps(id),
    leadModel.getActivities(id),
  ])
  return { ...lead, timeline, followUps, activities }
}

export async function create(payload, actor = 'System') {
  // An explicitly selected branch always wins; location auto-routing is the fallback
  // only when no branch was chosen.
  const resolvedBranch = await resolveBranchFromLocation(payload.location)
  const branchId = payload.branchId || resolvedBranch || null
  const autoRouted = !payload.branchId && Boolean(resolvedBranch)
  const lead = await leadModel.create({
    ref_code: refCode(),
    name: payload.name,
    company: payload.company,
    mobile: payload.mobile,
    email: payload.email,
    location: payload.location,
    product_id: payload.productId || null,
    source: payload.source,
    branch_id: branchId,
    staff_id: payload.staffId || null,
    status: 'New Lead',
    priority: payload.priority || 'Medium',
    value: payload.value || 0,
    score: payload.score ?? 50,
    expected_close_date: payload.expectedCloseDate || null,
    notes: payload.notes || '',
    tags: payload.tags || [],
    created_date: today(),
  })
  await leadModel.addTimeline({ lead_id: lead.id, type: 'created', title: 'Lead created', description: `Captured via ${payload.source || 'system'}`, date: today(), by: actor })
  if (lead.branch_id) {
    await leadModel.addTimeline({
      lead_id: lead.id,
      type: 'assigned',
      title: 'Branch assigned',
      description: autoRouted ? 'Auto-routed by location' : 'Assigned to selected branch',
      date: today(),
      by: 'System',
    })
    // Notify the branch's manager(s) + admins that a new lead arrived for the branch.
    await notificationService.emit({
      branchId: lead.branch_id,
      type: 'lead',
      title: 'New lead added',
      message: `${lead.name || 'A new lead'} was assigned to your branch${payload.location ? ` (${payload.location})` : ''}.`,
    })
  }
  return lead
}

export async function update(id, payload) {
  await getById(id)
  const fields = {}
  const map = {
    name: 'name', company: 'company', mobile: 'mobile', email: 'email', location: 'location',
    productId: 'product_id', source: 'source', branchId: 'branch_id', priority: 'priority',
    value: 'value', score: 'score', notes: 'notes', tags: 'tags', expectedCloseDate: 'expected_close_date',
  }
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) fields[col] = payload[k]
  return leadModel.update(id, fields)
}

export async function remove(id) {
  await getById(id)
  return leadModel.remove(id)
}

export async function assignStaff(id, staffId, staffName = 'staff') {
  const lead = await leadModel.findById(id)
  if (!lead) throw ApiError.notFound('Lead not found')
  const updated = await leadModel.update(id, {
    staff_id: staffId,
    status: lead.status === 'New Lead' ? 'Assigned' : lead.status,
    last_activity: new Date().toISOString(),
  })
  await leadModel.addTimeline({ lead_id: id, type: 'assigned', title: 'Staff assigned', description: `Allocated to ${staffName}`, date: today(), by: 'Branch Manager' })
  await leadModel.addActivity({ lead_id: id, action: 'Staff assigned', detail: `Allocated to ${staffName}`, date: today(), by: 'Branch Manager' })
  await notificationService.emit({
    branchId: lead.branch_id,
    staffId,
    type: 'lead',
    title: 'New lead assigned',
    message: `${lead.name} has been assigned to ${staffName}.`,
  })
  return updated
}

export async function updateStatus(id, status, actor = 'Sales') {
  if (!LEAD_STATUSES.includes(status)) throw ApiError.badRequest('Invalid lead status')
  const lead = await leadModel.findById(id)
  if (!lead) throw ApiError.notFound('Lead not found')
  const updated = await leadModel.update(id, { status, last_activity: new Date().toISOString() })
  await leadModel.addTimeline({ lead_id: id, type: 'status', title: status, description: `Stage moved to ${status}`, date: today(), by: actor })
  if (status === 'Won') {
    await notificationService.emit({ branchId: lead.branch_id, staffId: lead.staff_id, type: 'won', title: 'Deal won 🎉', message: `${lead.name} was marked as Won.` })
  } else if (status === 'Lost') {
    await notificationService.emit({ branchId: lead.branch_id, staffId: lead.staff_id, type: 'lead', title: 'Lead lost', message: `${lead.name} was marked as Lost.` })
  }
  return updated
}

export async function addFollowUp(id, payload, actor = 'Sales') {
  const lead = await leadModel.findById(id)
  if (!lead) throw ApiError.notFound('Lead not found')
  const followUp = await followupModel.create({
    lead_id: id,
    type: payload.type,
    status: payload.status || 'Scheduled',
    date: payload.date || today(),
    next_date: payload.nextDate || null,
    remark: payload.remark || '',
    by: payload.by || actor,
  })
  await leadModel.addActivity({ lead_id: id, action: `Follow-up (${payload.type})`, detail: payload.remark, date: payload.date || today(), by: payload.by || actor })
  await leadModel.update(id, { next_follow_up: payload.nextDate || null, last_activity: new Date().toISOString() })
  await notificationService.emit({
    branchId: lead.branch_id,
    staffId: lead.staff_id,
    type: 'followup',
    title: 'Follow-up scheduled',
    message: `${payload.type} for ${lead.name}${payload.nextDate ? ` on ${payload.nextDate}` : ''}.`,
  })
  return followUp
}

export async function stats() {
  return leadModel.countByStatus()
}
