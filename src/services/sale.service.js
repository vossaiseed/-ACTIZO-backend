import * as saleModel from '../models/sale.model.js'
import * as leadModel from '../models/lead.model.js'
import * as notificationService from './notification.service.js'
import { supabase } from '../config/supabase.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'

const refCode = () => `SL-${Date.now().toString().slice(-7)}`

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

export async function getById(id) {
  const sale = await saleModel.findById(id)
  if (!sale) throw ApiError.notFound('Sale not found')
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

export async function update(id, payload) {
  await getById(id)
  const fields = {}
  const map = {
    customer: 'customer', quantity: 'quantity', unitPrice: 'unit_price', discount: 'discount',
    amount: 'amount', date: 'date', status: 'status', paymentStatus: 'payment_status',
    paymentMethod: 'payment_method', remarks: 'remarks',
  }
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) fields[col] = payload[k]
  return saleModel.update(id, fields)
}

export async function remove(id) {
  await getById(id)
  return saleModel.remove(id)
}

export async function stats(scope = {}) {
  const rows = await saleModel.aggregate({ branchId: scope.branchId, staffId: scope.staffId })
  const completed = rows.filter((r) => r.status === 'Completed')
  const totalRevenue = completed.reduce((s, r) => s + Number(r.amount || 0), 0)

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
    .reduce((s, r) => s + Number(r.amount || 0), 0)

  const byProduct = {}
  const byBranch = {}
  for (const r of completed) {
    const p = r.product?.name || 'Unknown'
    const b = r.branch?.name || 'Unknown'
    byProduct[p] = (byProduct[p] || 0) + Number(r.amount || 0)
    byBranch[b] = (byBranch[b] || 0) + Number(r.amount || 0)
  }
  const topProducts = Object.entries(byProduct).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
  const branchSales = Object.entries(byBranch).map(([branch, revenue]) => ({ branch, revenue })).sort((a, b) => b.revenue - a.revenue)

  return {
    totalSales: completed.length,
    totalRevenue,
    monthlyRevenue,
    avgOrderValue: completed.length ? Math.round(totalRevenue / completed.length) : 0,
    conversionRate,
    topProducts,
    branchSales,
  }
}
