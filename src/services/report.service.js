import { supabase } from '../config/supabase.js'
import { ApiError } from '../utils/ApiError.js'
import * as targetModel from '../models/target.model.js'
import * as branchService from './branch.service.js'
import * as staffService from './staff.service.js'
import * as incentiveService from './incentive.service.js'
import { withAchievement } from './target.service.js'

/**
 * Reports are derived ENTIRELY from live data — the same engines that power the
 * Dashboard, Sales, Targets, Finance and Incentives pages — so every report row
 * reconciles with its home page. No seeded/aggregate tables are read.
 * Scope: Admin → all, Manager → their branch, Staff → their own records.
 */

const TYPES = ['lead', 'sales', 'revenue', 'branch', 'staff', 'target', 'incentive']

function groupCount(rows, key) {
  return rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {})
}
function groupSum(rows, key, valueKey) {
  return rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + Number(r[valueKey] || 0)), acc), {})
}

/** Completed sales (with amount + date) scoped to the caller. */
async function scopedCompletedSales({ branchId, staffId } = {}) {
  let q = supabase.from('sales').select('final_amount, amount, date, branch_id, staff_id').eq('status', 'Completed')
  if (branchId) q = q.eq('branch_id', branchId)
  if (staffId) q = q.eq('staff_id', staffId)
  const { data } = await q
  return data || []
}

/** Last-N-months revenue trend from completed sales. */
function monthlyTrend(sales, n = 8) {
  const byMonth = {}
  for (const s of sales) {
    const k = String(s.date || '').slice(0, 7)
    if (k) byMonth[k] = (byMonth[k] || 0) + Number(s.final_amount ?? s.amount ?? 0)
  }
  const now = new Date()
  const out = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ month: d.toLocaleString('en-US', { month: 'short' }), revenue: byMonth[k] || 0 })
  }
  return out
}

export async function generate(type, scope = {}) {
  if (!TYPES.includes(type)) throw ApiError.badRequest(`Unknown report type. Use one of: ${TYPES.join(', ')}`)
  const { branchId, staffId } = scope

  switch (type) {
    case 'lead': {
      let q = supabase.from('leads').select('ref_code,name,status,source,priority,value,created_date,branch:branches(name),staff:users(name)').order('created_date', { ascending: false }).limit(500)
      if (branchId) q = q.eq('branch_id', branchId)
      if (staffId) q = q.eq('staff_id', staffId)
      const { data } = await q
      const rows = data || []
      return {
        type,
        summary: { total: rows.length, won: rows.filter((r) => r.status === 'Won').length, lost: rows.filter((r) => r.status === 'Lost').length },
        charts: {
          byStatus: Object.entries(groupCount(rows, 'status')).map(([name, value]) => ({ name, value })),
          bySource: Object.entries(groupCount(rows, 'source')).map(([name, value]) => ({ name, value })),
        },
        rows,
      }
    }
    case 'sales': {
      let q = supabase.from('sales').select('ref_code,customer,final_amount,amount,date,status,product:products(name),branch:branches(name)').order('date', { ascending: false }).limit(500)
      if (branchId) q = q.eq('branch_id', branchId)
      if (staffId) q = q.eq('staff_id', staffId)
      const { data } = await q
      const rows = (data || []).map((r) => ({ ...r, amount: Number(r.final_amount ?? r.amount ?? 0) }))
      const completed = rows.filter((r) => r.status === 'Completed')
      return {
        type,
        summary: { totalSales: completed.length, totalRevenue: completed.reduce((s, r) => s + Number(r.amount || 0), 0) },
        charts: {
          byProduct: Object.entries(groupSum(completed.map((r) => ({ name: r.product?.name || '—', amount: r.amount })), 'name', 'amount')).map(([name, value]) => ({ name, value })),
        },
        rows,
      }
    }
    case 'revenue': {
      // Live: revenue = completed sales; profit = revenue − computed incentives.
      const [sales, inc] = await Promise.all([scopedCompletedSales(scope), incentiveService.earned(scope)])
      const totalExpense = Number(inc.summary.totalIncentives || 0)
      const trend = monthlyTrend(sales)
      const lastIdx = trend.length - 1
      // Incentives aren't time-bucketed → attribute the running total to the latest month.
      const rows = trend.map((m, i) => ({ month: m.month, revenue: m.revenue, profit: m.revenue - (i === lastIdx ? totalExpense : 0) }))
      const revenue = sales.reduce((s, r) => s + Number(r.final_amount ?? r.amount ?? 0), 0)
      return {
        type,
        summary: { revenue, profit: revenue - totalExpense },
        charts: { trend: rows },
        rows,
      }
    }
    case 'branch': {
      // Live branch metrics (same engine as the Branches page). Managers/staff
      // are limited to their own branch; admins see the whole network.
      const { data } = await branchService.list({ limit: 100 }, scope)
      const rows = (data || [])
        .filter((b) => !branchId || b.id === branchId)
        .map((b) => ({
          name: b.name,
          city: b.city,
          region: b.region,
          total_revenue: Number(b.total_revenue || 0),
          conversion_rate: Number(b.conversion_rate || 0),
          target_achievement: Number(b.target_achievement || 0),
        }))
      return {
        type,
        summary: { branches: rows.length, totalRevenue: rows.reduce((s, r) => s + r.total_revenue, 0) },
        charts: {
          revenue: rows.map((r) => ({ name: r.name, value: r.total_revenue })),
          achievement: rows.map((r) => ({ name: r.name, value: r.target_achievement })),
        },
        rows,
      }
    }
    case 'staff': {
      // Live staff metrics (same engine as the Staff page).
      const { data } = await staffService.list({ limit: 200 }, scope)
      let rows = data || []
      if (staffId) rows = rows.filter((s) => s.id === staffId)
      rows = rows.map((s) => ({
        name: s.name,
        role: s.role,
        branchName: s.branchName,
        conversionRate: Number(s.conversionRate || 0),
        revenue: Number(s.revenue || 0),
        performanceScore: Number(s.performanceScore || 0),
      }))
      return {
        type,
        summary: { staff: rows.length, totalRevenue: rows.reduce((s, r) => s + r.revenue, 0) },
        charts: { topByRevenue: [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((r) => ({ name: r.name, value: r.revenue })) },
        rows,
      }
    }
    case 'target': {
      // Live general-target achievement (same withAchievement engine as Targets).
      const sales = await targetModel.completedSalesForAchievement()
      const { data } = await targetModel.findAll('general', {
        branchScope: staffId ? null : branchId || null,
        staffId: staffId || undefined,
        from: 0,
        to: 9999,
      })
      const rows = (data || []).map((t) => {
        const a = withAchievement(t, sales)
        return {
          product: t.product?.name || '—',
          scope: t.scope,
          branchName: t.branch?.name || '—',
          targetQty: Number(t.target_qty || 0),
          achievedQty: a.achieved_qty,
          period: t.period || 'Monthly',
          completion: a.completion,
          status: a.status,
        }
      })
      return {
        type,
        summary: { total: rows.length, achieved: rows.filter((r) => ['Completed', 'Overachieved'].includes(r.status)).length },
        charts: { completion: rows.map((r) => ({ name: r.product, target: r.targetQty, achieved: r.achievedQty })) },
        rows,
      }
    }
    case 'incentive': {
      // Live computed incentives (same engine as the Incentives page).
      const { breakdown, branchWise, summary } = await incentiveService.earned(scope)
      const rows = breakdown.map((b) => ({
        staffName: b.staffName,
        branchName: b.branchName,
        month: b.period,
        total: Number(b.amount || 0),
        type: b.productName,
        status: b.status,
      }))
      return {
        type,
        summary: { total: Number(summary.totalIncentives || 0), paid: rows.filter((r) => r.status === 'Earned').length },
        charts: { byBranch: (branchWise || []).map((x) => ({ name: x.branch, value: Number(x.amount || 0) })) },
        rows,
      }
    }
    default:
      throw ApiError.badRequest('Unknown report type')
  }
}
