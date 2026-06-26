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
import * as userService from './user.service.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

const num = (v) => Number(v) || 0

/** id -> branch name */
async function branchMap() {
  const { data, error } = await supabase.from('branches').select('id, name')
  if (error) throw error
  return Object.fromEntries((data || []).map((b) => [b.id, b.name]))
}

/** Aggregate leads/sales/incentives per staff id in three bulk queries. */
async function buildMetrics(staffIds) {
  if (!staffIds.length) return {}
  const [leadsRes, salesRes, incRes] = await Promise.all([
    supabase.from('leads').select('staff_id, status').in('staff_id', staffIds),
    supabase.from('sales').select('staff_id, final_amount, amount, status').in('staff_id', staffIds),
    supabase.from('incentives').select('staff_id, total').in('staff_id', staffIds),
  ])
  const m = {}
  staffIds.forEach((id) => (m[id] = { assignedLeads: 0, wonLeads: 0, revenue: 0, incentiveEarned: 0 }))
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
  for (const i of incRes.data || []) {
    const e = m[i.staff_id]
    if (e) e.incentiveEarned += num(i.total)
  }
  return m
}

/** Merge a raw user row + computed metrics into the staff shape the UI uses. */
function shape(u, metrics, branchName) {
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
    achievement: target ? Math.round((revenue / target) * 100) : num(u.achievement),
    incentiveEarned: metrics?.incentiveEarned || num(u.incentive_earned),
    performanceScore: num(u.performance_score),
    rating: u.rating != null ? Number(u.rating) : null,
    ...(u.pin ? { pin: u.pin } : {}),
  }
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
  const [metrics, branches] = await Promise.all([buildMetrics(ids), branchMap()])
  const staff = (data || []).map((u) => shape(u, metrics[u.id], branches[u.branch_id]))
  return { data: staff, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id) {
  const u = await userModel.findPublicById(id)
  if (!u) throw ApiError.notFound('Staff member not found')
  const [metrics, branches] = await Promise.all([buildMetrics([id]), branchMap()])
  return shape(u, metrics[id], branches[u.branch_id])
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
