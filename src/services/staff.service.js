/**
 * Staff service — a sales-staff view over the `users` table (role = 'staff'),
 * enriched with performance metrics computed live from leads, sales and
 * incentives. Returns clean camelCase objects the frontend Staff module expects.
 *
 * CRUD (create/update/status/PIN) is delegated to the user service so there is
 * a single source of truth for account management.
 */
import { supabase } from '../config/supabase.js'
import * as userModel from '../models/user.model.js'
import * as leadModel from '../models/lead.model.js'
import * as userService from './user.service.js'
import * as incentiveService from './incentive.service.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

const num = (v) => Number(v) || 0

/** id -> branch name */
async function branchMap() {
  const { data, error } = await supabase.from('branches').select('id, name')
  if (error) throw error
  return Object.fromEntries((data || []).map((b) => [b.id, b.name]))
}

/** Aggregate leads + completed-sales revenue per staff id. Incentives are overlaid
 *  separately from the live incentive engine (single source of truth). */
async function buildMetrics(staffIds) {
  if (!staffIds.length) return {}
  const [leadsRes, salesRes] = await Promise.all([
    supabase.from('leads').select('staff_id, status').in('staff_id', staffIds),
    supabase.from('sales').select('staff_id, final_amount, amount, status').in('staff_id', staffIds),
  ])
  const m = {}
  staffIds.forEach((id) => (m[id] = { assignedLeads: 0, wonLeads: 0, revenue: 0 }))
  for (const l of leadsRes.data || []) {
    const e = m[l.staff_id]
    if (!e) continue
    e.assignedLeads += 1
    if (l.status === 'Won') e.wonLeads += 1
  }
  for (const s of salesRes.data || []) {
    const e = m[s.staff_id]
    if (!e || s.status === 'Refunded') continue
    e.revenue += num(s.final_amount ?? s.amount)
  }
  return m
}

/**
 * Real performance score from live signals — replaces the dead stored column:
 *   unit-target achievement (45%) + lead conversion (25%) + revenue contribution (30%).
 * Revenue is normalized against the team's top earner so the score self-scales.
 */
function scoreOf({ achievement = 0, conversionRate = 0, revenue = 0 }, maxRevenue = 0) {
  const revenuePoints = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
  const score = 0.45 * Math.min(achievement, 150) + 0.25 * conversionRate + 0.30 * revenuePoints
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** Merge a raw user row + computed metrics into the staff shape the UI uses. */
function shape(u, metrics, branchName, extra = {}) {
  const assignedLeads = metrics?.assignedLeads ?? num(u.assigned_leads)
  const wonLeads = metrics?.wonLeads ?? num(u.won_leads)
  const revenue = metrics?.revenue || num(u.revenue)
  const target = num(u.target)
  return {
    id: u.id,
    name: u.name,
    firstName: (u.name || '').split(' ')[0],
    role: u.position || 'Sales Executive',
    branchId: u.branch_id,
    branchName: branchName || null,
    email: u.email,
    phone: u.phone,
    avatarColor: u.avatar_color,
    joinDate: u.join_date,
    status: u.status,
    assignedLeads,
    wonLeads,
    conversionRate: assignedLeads ? Math.round((wonLeads / assignedLeads) * 100) : 0,
    revenue,
    target,
    // Achievement = live unit-target completion (from the incentive engine) when provided.
    achievement: extra.achievement != null ? extra.achievement : (target ? Math.round((revenue / target) * 100) : num(u.achievement)),
    incentiveEarned: extra.incentiveEarned != null ? extra.incentiveEarned : (metrics?.incentiveEarned || num(u.incentive_earned)),
    // performanceScore + rating are overlaid by the caller via scoreOf (needs team max revenue).
    performanceScore: extra.performanceScore != null ? extra.performanceScore : 0,
    rating: extra.rating != null ? extra.rating : 0,
    ...(u.pin ? { pin: u.pin } : {}),
  }
}

/** Team-wide top revenue (used to normalize the performance score). */
async function teamMaxRevenue() {
  const { data } = await userModel.findAll({ role: 'staff', from: 0, to: 999 })
  const ids = (data || []).map((u) => u.id)
  if (!ids.length) return 0
  const m = await buildMetrics(ids)
  return Math.max(0, ...Object.values(m).map((x) => x.revenue))
}

export async function list(query, scope = {}) {
  const q = parseListQuery(query, { defaultSort: 'performance_score' })
  const { data, count } = await userModel.findAll({
    role: 'staff',
    branchId: scope.branchId || query.branch,
    status: query.status,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  const ids = (data || []).map((u) => u.id)
  const [metrics, branches, incentiveData] = await Promise.all([
    buildMetrics(ids),
    branchMap(),
    incentiveService.earned(scope), // live incentives, same scope as the list
  ])
  const incByStaff = Object.fromEntries((incentiveData.items || []).map((i) => [i.staffId, i]))
  const staff = (data || []).map((u) =>
    shape(u, metrics[u.id], branches[u.branch_id], {
      achievement: incByStaff[u.id]?.completion ?? 0,
      incentiveEarned: incByStaff[u.id]?.amount ?? 0,
    }),
  )
  // Second pass: performance score + rating from real signals (needs team max revenue).
  const maxRev = Math.max(0, ...staff.map((s) => s.revenue))
  for (const s of staff) {
    s.performanceScore = scoreOf(s, maxRev)
    s.rating = Math.round((s.performanceScore / 20) * 10) / 10
  }
  return { data: staff, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id) {
  const u = await userModel.findPublicById(id)
  if (!u) throw ApiError.notFound('Staff member not found')
  // Pull the staff's real related collections so the profile tables aren't empty:
  // their leads, and their live-computed incentive breakdown (same engine as the
  // Incentives page — keeps every staff metric on the SAME staff id).
  const [metrics, branches, leadsRes, incentiveData, maxRev] = await Promise.all([
    buildMetrics([id]),
    branchMap(),
    leadModel.findAll({ staffId: id, from: 0, to: 499 }),
    incentiveService.earned({ branchId: u.branch_id, staffId: id }),
    teamMaxRevenue(),
  ])
  const assignedLeadsList = (leadsRes.data || []).map((l) => ({
    id: l.ref_code || l.id,
    name: l.name,
    company: l.company || '',
    product: l.product?.name || '',
    status: l.status,
    value: Number(l.value ?? l.amount ?? 0),
    createdDate: l.created_at,
    lastActivity: l.updated_at || l.created_at,
  }))
  const incentives = (incentiveData.breakdown || []).map((b) => ({
    id: b.id,
    product: b.productName,
    targetQty: b.targetQty,
    achievedQty: b.achievedQty,
    extraQty: b.extraQty,
    rate: b.rate,
    amount: b.amount,
    status: b.status,
  }))
  const base = shape(u, metrics[id], branches[u.branch_id], {
    achievement: incentiveData.items?.[0]?.completion ?? 0,
    incentiveEarned: incentiveData.summary.totalIncentives,
  })
  base.performanceScore = scoreOf(base, maxRev)
  base.rating = Math.round((base.performanceScore / 20) * 10) / 10
  return { ...base, assignedLeadsList, incentives }
}

export async function create(payload, actor = {}) {
  const created = await userService.create({ ...payload, role: 'staff' }, actor)
  return shape(created, null, null) // pin is carried through by shape()
}

export async function update(id, payload) {
  await userService.update(id, payload)
  return getById(id)
}

export async function setStatus(id, status) {
  await userService.setStatus(id, status)
  return getById(id)
}

export async function resetPin(id) {
  return userService.resetPin(id) // { pin }
}

export async function remove(id) {
  return userService.remove(id)
}
