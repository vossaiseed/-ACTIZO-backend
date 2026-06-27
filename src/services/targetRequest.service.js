import * as model from '../models/targetRequest.model.js'
import * as targetModel from '../models/target.model.js'
import * as notificationService from './notification.service.js'
import { ApiError } from '../utils/ApiError.js'
import { ROLES } from '../config/constants.js'

/** Admin sees all requests; a Branch Manager sees only their own branch's. */
export async function list(scope = {}) {
  return model.findAll({ branchId: scope.branchId || undefined })
}

/** Branch Manager raises a request to increase one of their branch targets. */
export async function create(payload, actor = {}) {
  const target = await targetModel.findGeneralById(payload.targetId)
  if (!target || target.scope !== 'Branch') {
    throw ApiError.badRequest('A request can only be raised on a branch-level target')
  }
  if (actor.role === ROLES.BRANCH_MANAGER && target.branch_id !== actor.branchId) {
    throw ApiError.forbidden('You can only request changes for your own branch target')
  }
  const requestedQty = Number(payload.requestedQty) || 0
  if (requestedQty <= Number(target.target_qty || 0)) {
    throw ApiError.badRequest('Requested target must be higher than the current target')
  }
  const req = await model.create({
    target_id: target.id,
    branch_id: target.branch_id,
    product_id: target.product_id,
    requested_by: actor.id || null,
    current_qty: Number(target.target_qty || 0),
    requested_qty: requestedQty,
    message: payload.message || '',
    status: 'Pending',
  })
  // The request goes TO the admin(s) only.
  await notificationService.emit({
    type: 'target-request',
    title: 'Target increase requested',
    message: `${actor.name || 'A branch manager'} requested raising ${target.product?.name || 'a product'} target from ${req.current_qty} to ${requestedQty}.`,
  })
  return req
}

/** Admin approves / rejects (optionally modifying the approved quantity). */
export async function resolve(id, payload, actor = {}) {
  const req = await model.findById(id)
  if (!req) throw ApiError.notFound('Request not found')
  if (req.status !== 'Pending') throw ApiError.badRequest('This request has already been resolved')

  const decision = payload.status
  if (!['Approved', 'Rejected'].includes(decision)) throw ApiError.badRequest('Decision must be Approved or Rejected')

  let approvedQty = null
  if (decision === 'Approved') {
    approvedQty = Number(payload.approvedQty ?? req.requested_qty) || 0
    // 1) Update the branch target's quantity (achievement/% recompute live).
    await targetModel.updateGeneral(req.target_id, { target_qty: approvedQty })
    // 2) Keep the parent Product target consistent — bump it if branch allocations now exceed it.
    const branchTarget = await targetModel.findGeneralById(req.target_id)
    if (branchTarget?.parent_id) {
      const siblings = await targetModel.findGeneral({ parentId: branchTarget.parent_id })
      const sum = siblings.reduce((s, b) => s + Number(b.target_qty || 0), 0)
      const product = await targetModel.findGeneralById(branchTarget.parent_id)
      if (product && sum > Number(product.target_qty || 0)) {
        await targetModel.updateGeneral(product.id, { target_qty: sum })
      }
    }
  }

  const updated = await model.update(id, {
    status: decision,
    approved_qty: approvedQty,
    admin_response: payload.adminResponse || '',
    resolved_by: actor.id || null,
  })

  // Notify ONLY the requesting branch manager of the outcome.
  await notificationService.create({
    userId: req.requested_by,
    type: 'target-request',
    title: `Target request ${decision.toLowerCase()}`,
    message:
      decision === 'Approved'
        ? `Your target was raised to ${approvedQty}.${payload.adminResponse ? ` Note: ${payload.adminResponse}` : ''}`
        : `Your target increase request was declined.${payload.adminResponse ? ` Reason: ${payload.adminResponse}` : ''}`,
  })
  return updated
}
