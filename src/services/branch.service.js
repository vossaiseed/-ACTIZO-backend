import { supabase } from '../config/supabase.js'
import * as branchModel from '../models/branch.model.js'
import * as targetModel from '../models/target.model.js'
import * as staffService from './staff.service.js'
import { withAchievement } from './target.service.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

// Aggregate unit targets (Product → Branch workflow) + units actually sold, per branch id.
async function unitProgress(ids = []) {
  const target = {}
  const sold = {}
  if (!ids.length) return { target, sold }
  const [tRes, sales] = await Promise.all([
    supabase.from('general_targets').select('branch_id, target_qty').eq('scope', 'Branch').in('branch_id', ids),
    targetModel.completedSalesForAchievement(),
  ])
  for (const r of tRes.data || []) {
    if (r.branch_id) target[r.branch_id] = (target[r.branch_id] || 0) + Number(r.target_qty || 0)
  }
  for (const s of sales) {
    if (s.branch_id && ids.includes(s.branch_id)) sold[s.branch_id] = (sold[s.branch_id] || 0) + Number(s.quantity || 0)
  }
  return { target, sold }
}

export async function list(query, scope = {}) {
  const q = parseListQuery(query)
  const { data, count } = await branchModel.findAll({
    // Branches is a company-wide performance comparison for Admin & Branch Managers.
    // Only individual Staff are restricted to their own branch (operational isolation).
    id: scope.staffId ? scope.branchId || undefined : undefined,
    region: query.region,
    status: query.status,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  // Overlay live-computed metrics so the cards never show stale seeded values.
  const ids = (data || []).map((b) => b.id)
  const [stats, units] = await Promise.all([branchModel.bulkStats(ids), unitProgress(ids)])
  const enriched = (data || []).map((b) => {
    const s = stats[b.id] || { staffCount: 0, totalLeads: 0, wonLeads: 0, totalSales: 0, revenue: 0 }
    const targetUnits = units.target[b.id] || 0
    const soldUnits = units.sold[b.id] || 0
    return {
      ...b,
      staff_count: s.staffCount,
      total_leads: s.totalLeads,
      won_leads: s.wonLeads,
      total_sales: s.totalSales,
      total_revenue: s.revenue,
      target_units: targetUnits,
      achieved_units: soldUnits,
      conversion_rate: s.totalLeads ? Math.round((s.wonLeads / s.totalLeads) * 100) : 0,
      target_achievement: targetUnits > 0 ? Math.round((soldUnits / targetUnits) * 100) : 0,
    }
  })
  return { data: enriched, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id) {
  const branch = await branchModel.findById(id)
  if (!branch) throw ApiError.notFound('Branch not found')
  const [stats, sales, units, staffRes, targetRows, achSales] = await Promise.all([
    branchModel.stats(id),
    branchModel.completedSales(id),
    unitProgress([id]),
    staffService.list({}, { branchId: id }), // real staff of this branch
    targetModel.findGeneral({ scope: 'Branch', branchId: id }), // this branch's targets
    targetModel.completedSalesForAchievement(),
  ])
  const targetUnits = units.target[id] || 0
  const soldUnits = units.sold[id] || 0

  // Branch's targets with LIVE achievement (same engine as the Targets page).
  const targets = (targetRows || []).map((t) => {
    const a = withAchievement(t, achSales)
    return {
      id: t.id,
      product: t.product?.name || '—',
      unit: t.product?.unit || 'units',
      scope: t.scope,
      period: t.period || 'Monthly',
      status: a.status,
      targetQty: Number(t.target_qty || 0),
      achievedQty: a.achieved_qty,
      completion: a.completion,
    }
  })

  // Live monthly revenue + last-8-months trend from actual completed sales.
  const byMonth = {}
  for (const s of sales) {
    const key = String(s.date || '').slice(0, 7) // YYYY-MM
    if (key) byMonth[key] = (byMonth[key] || 0) + Number(s.final_amount ?? s.amount ?? 0)
  }
  const now = new Date()
  const revenueTrend = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    revenueTrend.push({ month: d.toLocaleString('en-US', { month: 'short' }), revenue: byMonth[key] || 0 })
  }
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return {
    ...branch,
    stats,
    // Live values (replace the seeded static columns) — target achievement is unit-based.
    target_units: targetUnits,
    achieved_units: soldUnits,
    target_achievement: targetUnits > 0 ? Math.round((soldUnits / targetUnits) * 100) : 0,
    total_revenue: stats.revenue,
    staff_count: stats.staffCount,
    total_leads: stats.totalLeads,
    total_sales: stats.totalSales,
    won_leads: stats.wonLeads,
    monthly_revenue: byMonth[currentKey] || 0,
    revenue_trend: revenueTrend,
    staff: staffRes.data || [], // real branch staff (Branch Staff section)
    targets, // this branch's targets with live achievement (Branch Targets section)
  }
}

export async function getStats(id) {
  const branch = await branchModel.findById(id)
  if (!branch) throw ApiError.notFound('Branch not found')
  return branchModel.stats(id)
}

export async function create(payload) {
  return branchModel.create(payload)
}

export async function update(id, payload, scope = {}) {
  await getById(id)
  // A Branch Manager may only edit their own branch (Admin has no branch scope).
  if (scope.branchId && id !== scope.branchId) {
    throw ApiError.forbidden('You can only update your own branch')
  }
  const fields = {}
  const map = {
    name: 'name', code: 'code', email: 'email', phone: 'phone', city: 'city',
    region: 'region', manager: 'manager', address: 'address', status: 'status',
    established: 'established', targetRevenue: 'target_revenue', monthlyTarget: 'monthly_target',
  }
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) fields[col] = payload[k]
  if (Object.keys(fields).length === 0) return getById(id) // nothing to change
  return branchModel.update(id, fields)
}

export async function remove(id) {
  await getById(id)
  return branchModel.remove(id)
}
