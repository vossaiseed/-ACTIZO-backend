import * as saleModel from '../models/sale.model.js'
import * as leadModel from '../models/lead.model.js'
import * as notificationService from './notification.service.js'
import { supabase } from '../config/supabase.js'
import { ApiError } from '../utils/ApiError.js'
import { assertScopeAccess } from '../middleware/rbac.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

const refCode = () => `SL-${Date.now().toString().slice(-7)}`

/** Adjust a product's stored "sold" counter by a signed delta (never below 0). */
async function adjustProductSold(productId, delta) {
  if (!productId || !delta) return
  const { data: prod } = await supabase.from('products').select('sold').eq('id', productId).maybeSingle()
  if (prod) {
    await supabase.from('products').update({ sold: Math.max(0, Number(prod.sold || 0) + delta) }).eq('id', productId)
  }
}

export async function list(query, scope = {}) {
  const q = parseListQuery(query, { defaultSort: 'date' })
  const { data, count } = await saleModel.findAll({
    branchId: scope.branchId || query.branch,
    staffId: scope.staffId || query.staff,
    productId: query.product,
    status: query.status,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  return { data, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id, scope = {}) {
  const sale = await saleModel.findById(id)
  if (!sale) throw ApiError.notFound('Sale not found')
  assertScopeAccess(scope, { branchId: sale.branch_id, staffId: sale.staff_id })
  return sale
}

export async function create(payload) {
  // Spec #6: a sale created from a lead requires that lead to be Won.
  if (payload.leadId) {
    const lead = await leadModel.findById(payload.leadId)
    if (!lead) throw ApiError.notFound('Lead not found')
    if (lead.status !== 'Won') throw ApiError.badRequest('Only Won leads can be converted into a sale')
  }

  const quantity = Number(payload.quantity) || 0
  const unitPrice = Number(payload.unitPrice) || 0
  const discount = Number(payload.discount) || 0
  const totalAmount = quantity * unitPrice
  const finalAmount = Math.max(0, totalAmount - discount)
  const paymentStatus = payload.paymentStatus || 'Paid'

  // Attribution integrity: a supplied staffId must belong to the sale's branch,
  // so a sale (and its incentive/achievement) can't be credited to staff in
  // another branch. Staff self-record is already forced to their own id/branch.
  if (payload.staffId) {
    const { data: staffRow } = await supabase
      .from('users').select('id, branch_id').eq('id', payload.staffId).maybeSingle()
    if (!staffRow) throw ApiError.badRequest('Selected staff member does not exist')
    if (payload.branchId && staffRow.branch_id !== payload.branchId) {
      throw ApiError.badRequest('The selected staff member does not belong to this branch')
    }
  }

  // A flash link is only valid if the campaign is Active and for the same product.
  let flashTargetId = payload.flashTargetId || null
  if (flashTargetId) {
    const { data: ft } = await supabase
      .from('flash_targets').select('id, product_id, status').eq('id', flashTargetId).maybeSingle()
    if (!ft || ft.status !== 'Active' || (payload.productId && ft.product_id !== payload.productId)) {
      flashTargetId = null
    }
  }

  const sale = await saleModel.create({
    ref_code: refCode(),
    lead_id: payload.leadId || null,
    customer: payload.customer,
    product_id: payload.productId || null,
    category: payload.category || null,
    branch_id: payload.branchId || null,
    staff_id: payload.staffId || null,
    flash_target_id: flashTargetId, // links the sale to a flash campaign (validated)
    quantity,
    unit: payload.unit || null,
    unit_price: unitPrice,
    total_amount: totalAmount,
    discount,
    final_amount: finalAmount,
    amount: finalAmount,
    date: payload.date || new Date().toISOString().slice(0, 10),
    status: paymentStatus === 'Paid' ? 'Completed' : 'Pending',
    payment_status: paymentStatus,
    payment_method: payload.paymentMethod || 'Cash',
    remarks: payload.remarks || '',
  })
  // Spec #6: auto-update product units sold (revenue / branch / staff / target
  // achievement are all computed live from sales elsewhere — no manual update).
  if (payload.productId && sale.status === 'Completed') {
    const { data: prod } = await supabase.from('products').select('sold').eq('id', payload.productId).maybeSingle()
    if (prod) {
      await supabase.from('products').update({ sold: Number(prod.sold || 0) + quantity }).eq('id', payload.productId)
    }
  }

  await notificationService.emit({
    branchId: sale.branch_id,
    staffId: sale.staff_id,
    type: 'sale',
    title: 'New sale recorded',
    message: `${payload.customer} — ₹${finalAmount.toLocaleString('en-IN')}`,
  })
  return sale
}

export async function update(id, payload, scope = {}) {
  const current = await getById(id, scope)

  // Merge changed inputs over the current row, then RECOMPUTE the derived money
  // and status so stored amounts never drift (live revenue/target/incentive math
  // reads quantity/unit_price/status directly).
  const quantity = payload.quantity !== undefined ? Number(payload.quantity) || 0 : Number(current.quantity || 0)
  const unitPrice = payload.unitPrice !== undefined ? Number(payload.unitPrice) || 0 : Number(current.unit_price || 0)
  const discount = payload.discount !== undefined ? Number(payload.discount) || 0 : Number(current.discount || 0)
  const totalAmount = quantity * unitPrice
  const finalAmount = Math.max(0, totalAmount - discount)

  const paymentStatus = payload.paymentStatus !== undefined ? payload.paymentStatus : current.payment_status
  let status
  if (payload.status !== undefined) status = payload.status
  else if (payload.paymentStatus !== undefined) status = paymentStatus === 'Paid' ? 'Completed' : 'Pending'
  else status = current.status

  const fields = {
    quantity,
    unit_price: unitPrice,
    discount,
    total_amount: totalAmount,
    final_amount: finalAmount,
    amount: finalAmount,
    payment_status: paymentStatus,
    status,
  }
  if (payload.customer !== undefined) fields.customer = payload.customer
  if (payload.date !== undefined) fields.date = payload.date
  if (payload.paymentMethod !== undefined) fields.payment_method = payload.paymentMethod
  if (payload.remarks !== undefined) fields.remarks = payload.remarks

  const updated = await saleModel.update(id, fields)

  // Keep products.sold in sync with the change in this sale's Completed contribution.
  const oldContribution = current.status === 'Completed' ? Number(current.quantity || 0) : 0
  const newContribution = status === 'Completed' ? quantity : 0
  await adjustProductSold(current.product_id, newContribution - oldContribution)

  return updated
}

export async function remove(id, scope = {}) {
  const current = await getById(id, scope)
  const res = await saleModel.remove(id)
  // A deleted Completed sale must give back its units from products.sold.
  if (current.status === 'Completed') {
    await adjustProductSold(current.product_id, -Number(current.quantity || 0))
  }
  return res
}

export async function stats(scope = {}) {
  const rows = await saleModel.aggregate({ branchId: scope.branchId, staffId: scope.staffId })
  const completed = rows.filter((r) => r.status === 'Completed')
  const rev = (r) => Number(r.final_amount ?? r.amount ?? 0)
  const totalRevenue = completed.reduce((s, r) => s + rev(r), 0)

  // Live conversion rate = Won leads / total leads, scoped to the caller's role.
  let leadQ = supabase.from('leads').select('status')
  if (scope.branchId) leadQ = leadQ.eq('branch_id', scope.branchId)
  if (scope.staffId) leadQ = leadQ.eq('staff_id', scope.staffId)
  const { data: leadRows } = await leadQ
  const totalLeads = (leadRows || []).length
  const wonLeads = (leadRows || []).filter((l) => l.status === 'Won').length
  const conversionRate = totalLeads ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const monthlyRevenue = completed
    .filter((r) => String(r.date || '').startsWith(monthPrefix))
    .reduce((s, r) => s + rev(r), 0)

  const byProduct = {}
  const byBranch = {}
  const byStaff = {}
  for (const r of completed) {
    const p = r.product?.name || 'Unknown'
    const b = r.branch?.name || 'Unknown'
    byProduct[p] = (byProduct[p] || 0) + rev(r)
    byBranch[b] = (byBranch[b] || 0) + rev(r)
    const sName = r.staff?.name
    if (sName) {
      if (!byStaff[sName]) byStaff[sName] = { name: sName, branch: b, revenue: 0, orders: 0 }
      byStaff[sName].revenue += rev(r)
      byStaff[sName].orders += 1
    }
  }
  const topProducts = Object.entries(byProduct).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  const branchSales = Object.entries(byBranch).map(([branch, revenue]) => ({ branch, revenue })).sort((a, b) => b.revenue - a.revenue)
  const staffSales = Object.values(byStaff).sort((a, b) => b.revenue - a.revenue)

  // Last-8-months sales revenue trend.
  const byMonth = {}
  for (const r of completed) {
    const k = String(r.date || '').slice(0, 7)
    if (k) byMonth[k] = (byMonth[k] || 0) + rev(r)
  }
  const now = new Date()
  const monthlySalesTrend = []
  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlySalesTrend.push({ month: d.toLocaleString('en-US', { month: 'short' }), sales: byMonth[k] || 0 })
  }

  return {
    totalSales: completed.length,
    totalRevenue,
    monthlyRevenue,
    avgOrderValue: completed.length ? Math.round(totalRevenue / completed.length) : 0,
    conversionRate,
    topProducts,
    branchSales,
    staffSales,
    monthlySalesTrend,
  }
}
