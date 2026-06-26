import * as targetModel from '../models/target.model.js'
import { withAchievement } from './target.service.js'
import { buildMeta } from '../utils/pagination.js'

/**
 * Incentives are NOT stored or entered manually. They are derived live from:
 *   Staff Targets (general_targets, scope='Staff')  +  Completed Sales.
 *
 * For each staff target:  extraUnits = max(0, unitsSold - targetQty)
 *                         incentive  = extraUnits × incentiveRate (₹ per extra unit)
 * A staff's total incentive is the sum across all their product staff-targets.
 *
 * Role scope (resolved in the controller via requestScope):
 *   Admin   → all staff, every branch
 *   Manager → only staff in their branch
 *   Staff   → only their own record
 */
export async function earned(scope = {}) {
  const branchId = scope.branchId || null
  const staffId = scope.staffId || null

  // Staff-level targets (one per staff × product) scoped to the caller's role.
  const targets = await targetModel.findGeneral({
    scope: 'Staff',
    branchId: branchId || undefined,
    staffId: staffId || undefined,
  })
  const sales = await targetModel.completedSalesForAchievement()

  // Per product-target rows (the audit-level breakdown) — incentive computed by the shared engine.
  const breakdown = targets
    .filter((t) => t.staff_id) // a Staff target must point at a staff member
    .map((t) => {
      const a = withAchievement(t, sales)
      const rate = Number(t.incentive || 0)
      return {
        id: t.id,
        staffId: t.staff_id,
        staffName: t.staff?.name || '—',
        avatarColor: t.staff?.avatar_color || null,
        branchId: t.branch_id,
        branchName: t.branch?.name || '—',
        productName: t.product?.name || '—',
        period: t.period || 'Monthly',
        targetQty: Number(t.target_qty || 0),
        achievedQty: a.achieved_qty,
        extraQty: a.incentive_extra_qty,
        rate,
        amount: a.incentive_amount,
        completion: a.completion,
        status: a.incentive_amount > 0 ? 'Earned' : 'Active',
      }
    })

  // Aggregate per staff (sum incentive across their product targets).
  const byStaff = new Map()
  for (const r of breakdown) {
    let acc = byStaff.get(r.staffId)
    if (!acc) {
      acc = {
        id: r.staffId,
        staffId: r.staffId,
        staffName: r.staffName,
        avatarColor: r.avatarColor,
        branchId: r.branchId,
        branchName: r.branchName,
        targetQty: 0,
        achievedQty: 0,
        extraQty: 0,
        amount: 0,
        productCount: 0,
      }
      byStaff.set(r.staffId, acc)
    }
    acc.targetQty += r.targetQty
    acc.achievedQty += r.achievedQty
    acc.extraQty += r.extraQty
    acc.amount += r.amount
    acc.productCount += 1
  }

  const items = [...byStaff.values()]
    .map((s) => ({
      ...s,
      completion: s.targetQty ? Math.round((s.achievedQty / s.targetQty) * 100) : 0,
      status: s.amount > 0 ? 'Earned' : 'Active',
    }))
    .sort((a, b) => b.amount - a.amount)

  // Branch-wise totals (Admin overview / charts).
  const branchMap = new Map()
  for (const s of items) {
    const key = s.branchName || '—'
    branchMap.set(key, (branchMap.get(key) || 0) + s.amount)
  }
  const branchWise = [...branchMap.entries()]
    .map(([branch, amount]) => ({ branch, amount }))
    .sort((a, b) => b.amount - a.amount)

  const totalIncentives = items.reduce((s, r) => s + r.amount, 0)
  const highestIncentive = items.reduce((m, r) => Math.max(m, r.amount), 0)
  const earningStaff = items.filter((r) => r.amount > 0).length
  const top = items.find((r) => r.amount > 0) || null

  const summary = {
    totalIncentives,
    highestIncentive,
    monthlyIncentive: totalIncentives, // computed live for the active period
    earningStaff,
    staffCount: items.length,
    topPerformer: top
      ? { name: top.staffName, total: top.amount, avatarColor: top.avatarColor, branchName: top.branchName }
      : null,
  }

  return { items, breakdown, branchWise, summary }
}

/* ---- API surface (read-only; incentives are never created/edited by hand) ---- */

export async function list(query, scope = {}) {
  const { items } = await earned(scope)
  return { data: items, meta: buildMeta({ page: 1, limit: items.length || 1, total: items.length }) }
}

export async function history(query, scope = {}) {
  const { breakdown } = await earned(scope)
  return { data: breakdown, meta: buildMeta({ page: 1, limit: breakdown.length || 1, total: breakdown.length }) }
}

export async function summary(scope = {}) {
  const { summary } = await earned(scope)
  return summary
}
