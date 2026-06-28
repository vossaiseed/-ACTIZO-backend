import * as model from '../models/flashTarget.model.js'
import * as notificationService from './notification.service.js'
import { supabase } from '../config/supabase.js'
import { ApiError } from '../utils/ApiError.js'

const today = () => new Date().toISOString().slice(0, 10)

/* Notify every active Branch Manager (campaign launch + expiry). */
async function notifyAllBranchManagers({ type, title, message }) {
  const { data: mgrs } = await supabase.from('users').select('id').eq('role', 'branch_manager').eq('status', 'active')
  for (const m of mgrs || []) {
    // eslint-disable-next-line no-await-in-loop
    await notificationService.create({ userId: m.id, type, title, message })
  }
}

/* Lazily expire any Active campaign past its end date (notify managers once). */
async function expireDue(campaigns) {
  for (const c of campaigns) {
    if (c.status === 'Active' && c.end_date && c.end_date < today()) {
      // eslint-disable-next-line no-await-in-loop
      await model.updateCampaign(c.id, { status: 'Expired' })
      c.status = 'Expired'
      // eslint-disable-next-line no-await-in-loop
      await notifyAllBranchManagers({
        type: 'flash-target',
        title: 'Flash Target expired',
        message: `The flash target for ${c.product?.name || 'a product'} has expired.`,
      })
    }
  }
  return campaigns
}

/* Build achievement lookups from flash-linked completed sales. */
function achievementMaps(sales) {
  const byCampaign = {}, byBranch = {}, byStaff = {}
  const cntCampaign = {}, cntBranch = {}, cntStaff = {}
  for (const s of sales) {
    const q = Number(s.quantity || 0)
    byCampaign[s.flash_target_id] = (byCampaign[s.flash_target_id] || 0) + q
    if (s.branch_id) byBranch[`${s.flash_target_id}:${s.branch_id}`] = (byBranch[`${s.flash_target_id}:${s.branch_id}`] || 0) + q
    if (s.staff_id) byStaff[`${s.flash_target_id}:${s.staff_id}`] = (byStaff[`${s.flash_target_id}:${s.staff_id}`] || 0) + q
    // Number of completed sales (count), per scope.
    cntCampaign[s.flash_target_id] = (cntCampaign[s.flash_target_id] || 0) + 1
    if (s.branch_id) cntBranch[`${s.flash_target_id}:${s.branch_id}`] = (cntBranch[`${s.flash_target_id}:${s.branch_id}`] || 0) + 1
    if (s.staff_id) cntStaff[`${s.flash_target_id}:${s.staff_id}`] = (cntStaff[`${s.flash_target_id}:${s.staff_id}`] || 0) + 1
  }
  return { byCampaign, byBranch, byStaff, cntCampaign, cntBranch, cntStaff }
}

// Achievement % is measured against the APPROVED/assigned quantity (2 decimals).
const pct = (a, t) => (Number(t) > 0 ? Math.round((Number(a) / Number(t)) * 10000) / 100 : 0)

/** Derived display status: Pending (not started) | Active | Completed | Expired. */
function statusOf(c, achieved, approved) {
  if (c.status === 'Expired') return 'Expired'
  if (approved > 0 && achieved >= approved) return 'Completed'
  if (c.start_date && c.start_date > today()) return 'Pending'
  return 'Active'
}

/**
 * Role-scoped Flash Target overview.
 *  Admin   → all campaigns, all branch requests, all staff allocations
 *  Manager → all campaigns, their branch request, their branch's staff allocations
 *  Staff   → campaigns they're allocated to, their own allocations only
 */
export async function list(scope = {}) {
  const branchId = scope.branchId || null
  const staffId = scope.staffId || null

  let campaigns = await model.findCampaigns()
  campaigns = await expireDue(campaigns)
  const sales = await model.flashSales()
  const { byCampaign, byBranch, byStaff, cntCampaign, cntBranch, cntStaff } = achievementMaps(sales)

  // All branch targets (for totalApproved + scoping).
  const allBranchTargets = await model.findBranchTargets()
  const approvedByCampaign = {}
  for (const bt of allBranchTargets) {
    approvedByCampaign[bt.flash_target_id] = (approvedByCampaign[bt.flash_target_id] || 0) + Number(bt.approved_qty || 0)
  }

  const branchTargets = (branchId ? allBranchTargets.filter((b) => b.branch_id === branchId) : allBranchTargets).map((b) => {
    const achieved = byBranch[`${b.flash_target_id}:${b.branch_id}`] || 0
    const approved = Number(b.approved_qty || 0)
    return {
      ...b,
      achieved,
      salesCount: cntBranch[`${b.flash_target_id}:${b.branch_id}`] || 0,
      remaining: Math.max(0, approved - achieved),
      achievementPct: pct(achieved, approved),
      completion: pct(achieved, approved),
    }
  })

  const allStaffTargets = await model.findStaffTargets({})
  const staffTargets = allStaffTargets
    .filter((s) => (staffId ? s.staff_id === staffId : branchId ? s.branch_id === branchId : true))
    .map((s) => {
      const achieved = byStaff[`${s.flash_target_id}:${s.staff_id}`] || 0
      const qty = Number(s.qty || 0)
      return {
        ...s,
        achieved,
        salesCount: cntStaff[`${s.flash_target_id}:${s.staff_id}`] || 0,
        remaining: Math.max(0, qty - achieved),
        achievementPct: pct(achieved, qty),
        completion: pct(achieved, qty),
      }
    })

  // Staff only see campaigns they're allocated to.
  let visibleCampaigns = campaigns
  if (staffId) {
    const ids = new Set(staffTargets.map((s) => s.flash_target_id))
    visibleCampaigns = campaigns.filter((c) => ids.has(c.id))
  }

  const enrichedCampaigns = visibleCampaigns.map((c) => {
    const achieved = byCampaign[c.id] || 0
    const approved = approvedByCampaign[c.id] || 0
    const total = Number(c.total_qty || 0)
    return {
      ...c,
      status: statusOf(c, achieved, approved), // derived display status
      achieved,
      totalApproved: approved,
      salesCount: cntCampaign[c.id] || 0,
      // Achievement is measured against the approved commitment (matches spec example).
      achievementPct: pct(achieved, approved),
      completion: pct(achieved, approved),
      remaining: Math.max(0, approved - achieved), // approved still to achieve
      unallocated: Math.max(0, total - approved), // not yet approved to any branch
      // Convenience for the manager UI: their own branch request on this campaign (if any).
      myBranchTarget: branchId ? branchTargets.find((b) => b.flash_target_id === c.id) || null : undefined,
    }
  })

  return { campaigns: enrichedCampaigns, branchTargets, staffTargets }
}

/* ---------------- Admin: create campaign ---------------- */
export async function createCampaign(payload, actor = {}) {
  if (!payload.productId) throw ApiError.badRequest('Product is required')
  const total = Number(payload.totalQty) || 0
  if (total <= 0) throw ApiError.badRequest('Total quantity must be greater than 0')
  if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
    throw ApiError.badRequest('End date must be after the start date')
  }
  const c = await model.createCampaign({
    product_id: payload.productId,
    total_qty: total,
    start_date: payload.startDate || today(),
    end_date: payload.endDate || null,
    description: payload.description || '',
    status: 'Active',
    created_by: actor.id || null,
  })
  await notifyAllBranchManagers({
    type: 'flash-target',
    title: 'New Flash Target available',
    message: `A new flash target for ${c.product?.name || 'a product'} (${total} units) is open${c.end_date ? ` until ${c.end_date}` : ''}. Submit your branch request.`,
  })
  return c
}

/* ---------------- Branch Manager: submit request ---------------- */
export async function submitBranchRequest(flashTargetId, payload, actor = {}) {
  const c = await model.findCampaignById(flashTargetId)
  if (!c) throw ApiError.notFound('Flash target not found')
  if (c.status !== 'Active') throw ApiError.badRequest('This flash target is no longer active')
  if (c.end_date && c.end_date < today()) throw ApiError.badRequest('The deadline for this flash target has passed')
  const branchId = actor.branchId
  if (!branchId) throw ApiError.badRequest('You are not assigned to a branch')
  const existing = await model.findBranchTarget(flashTargetId, branchId)
  if (existing) throw ApiError.badRequest('Your branch has already submitted a request for this flash target')
  const qty = Number(payload.requestedQty) || 0
  if (qty <= 0) throw ApiError.badRequest('Requested quantity must be greater than 0')

  const bt = await model.createBranchTarget({
    flash_target_id: flashTargetId,
    branch_id: branchId,
    requested_by: actor.id || null,
    requested_qty: qty,
    status: 'Pending',
  })
  await notificationService.emit({
    type: 'flash-target',
    title: 'Flash Target request submitted',
    message: `${actor.name || 'A branch manager'} requested ${qty} units for the ${c.product?.name || ''} flash target.`,
  })
  return bt
}

/* ---------------- Admin: approve / partially approve / reject ---------------- */
export async function resolveBranchRequest(id, payload, actor = {}) {
  const bt = await model.findBranchTargetById(id)
  if (!bt) throw ApiError.notFound('Request not found')
  if (bt.status !== 'Pending') throw ApiError.badRequest('This request has already been resolved')
  const decision = payload.status
  if (!['Approved', 'Partially Approved', 'Rejected'].includes(decision)) {
    throw ApiError.badRequest('Decision must be Approved, Partially Approved, or Rejected')
  }

  let approvedQty = 0
  if (decision !== 'Rejected') {
    approvedQty = Number(payload.approvedQty ?? bt.requested_qty) || 0
    if (approvedQty <= 0) throw ApiError.badRequest('Approved quantity must be greater than 0')
    if (approvedQty > Number(bt.requested_qty || 0)) {
      throw ApiError.badRequest('Approved quantity cannot exceed the requested quantity')
    }
    // Total approved across all branches must never exceed the campaign total.
    const campaign = await model.findCampaignById(bt.flash_target_id)
    const siblings = await model.findBranchTargets({ flashTargetId: bt.flash_target_id })
    const otherApproved = siblings.filter((o) => o.id !== id).reduce((s, o) => s + Number(o.approved_qty || 0), 0)
    if (otherApproved + approvedQty > Number(campaign.total_qty || 0)) {
      throw ApiError.badRequest(
        `Total approved (${otherApproved + approvedQty}) would exceed the flash target total (${campaign.total_qty}). Remaining: ${Math.max(0, Number(campaign.total_qty || 0) - otherApproved)}.`,
      )
    }
  }

  const updated = await model.updateBranchTarget(id, {
    status: decision,
    approved_qty: decision === 'Rejected' ? 0 : approvedQty,
    admin_response: payload.adminResponse || '',
    resolved_by: actor.id || null,
  })
  await notificationService.create({
    userId: bt.requested_by,
    type: 'flash-target',
    title: `Flash Target request ${decision.toLowerCase()}`,
    message:
      decision === 'Rejected'
        ? `Your flash target request was rejected.${payload.adminResponse ? ` Reason: ${payload.adminResponse}` : ''}`
        : `Your flash target was approved for ${approvedQty} units. You can now distribute it to your staff.`,
  })
  return updated
}

/* ---------------- Branch Manager: distribute to staff ---------------- */
export async function distributeToStaff(flashTargetId, allocations = [], actor = {}) {
  const branchId = actor.branchId
  if (!branchId) throw ApiError.badRequest('You are not assigned to a branch')
  const bt = await model.findBranchTarget(flashTargetId, branchId)
  if (!bt || !['Approved', 'Partially Approved'].includes(bt.status)) {
    throw ApiError.badRequest('Your branch has no approved flash target to distribute yet')
  }
  const approved = Number(bt.approved_qty || 0)
  const valid = allocations.filter((a) => a.staffId && Number(a.qty) > 0)
  const total = valid.reduce((s, a) => s + Number(a.qty), 0)
  if (total > approved) {
    throw ApiError.badRequest(`Staff allocation total (${total}) exceeds the approved branch quantity (${approved}).`)
  }
  const { data: branchStaff } = await supabase.from('users').select('id').eq('branch_id', branchId).eq('role', 'staff')
  const allowed = new Set((branchStaff || []).map((s) => s.id))

  const keep = []
  for (const a of valid) {
    if (!allowed.has(a.staffId)) throw ApiError.badRequest('You can only allocate to staff within your own branch')
    // eslint-disable-next-line no-await-in-loop
    const row = await model.upsertStaffTarget({
      flash_target_id: flashTargetId,
      branch_id: branchId,
      staff_id: a.staffId,
      qty: Number(a.qty),
    })
    keep.push(row.id)
    // eslint-disable-next-line no-await-in-loop
    await notificationService.create({
      userId: a.staffId,
      type: 'flash-target',
      title: 'Flash Target assigned',
      message: `You have a flash target of ${a.qty} units. Link your sales to it to record progress.`,
    })
  }
  await model.deleteStaffTargets(flashTargetId, branchId, keep)
  return model.findStaffTargets({ flashTargetId, branchId })
}

/* Active flash campaigns a staff member is allocated to — used by the sale form. */
export async function activeForStaff(staffId) {
  if (!staffId) return []
  const [staffTargets, campaigns] = await Promise.all([
    model.findStaffTargets({ staffId }),
    model.findCampaigns({ status: 'Active' }),
  ])
  const byId = Object.fromEntries(campaigns.map((c) => [c.id, c]))
  return staffTargets
    .filter((s) => byId[s.flash_target_id])
    .map((s) => ({ id: s.flash_target_id, qty: s.qty, product: byId[s.flash_target_id].product?.name }))
}
