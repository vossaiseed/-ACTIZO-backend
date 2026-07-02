import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'
import * as leadService from '../services/lead.service.js'

export const list = asyncHandler(async (req, res) => {
  // Staff see only their own leads; managers their branch; admin all.
  const { data, meta } = await leadService.list(req.query, requestScope(req))
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await leadService.getById(req.params.id, requestScope(req)) })
})

export const create = asyncHandler(async (req, res) => {
  const payload = { ...req.body }
  // Admin chooses the branch; managers/staff are bound to their own branch.
  if (req.user?.role === ROLES.BRANCH_MANAGER) {
    payload.branchId = req.user.branchId
  } else if (req.user?.role === ROLES.STAFF) {
    payload.branchId = req.user.branchId
    payload.staffId = req.user.id
  }
  const lead = await leadService.create(payload, req.user?.name || 'System')
  sendCreated(res, lead, 'Lead created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await leadService.update(req.params.id, req.body, requestScope(req)), message: 'Lead updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await leadService.remove(req.params.id, requestScope(req))
  sendSuccess(res, { message: 'Lead deleted' })
})

export const assign = asyncHandler(async (req, res) => {
  const data = await leadService.assignStaff(req.params.id, req.body.staffId, req.body.staffName, requestScope(req))
  sendSuccess(res, { data, message: 'Lead assigned' })
})

export const updateStatus = asyncHandler(async (req, res) => {
  const data = await leadService.updateStatus(req.params.id, req.body.status, req.user?.name, requestScope(req))
  sendSuccess(res, { data, message: 'Status updated' })
})

export const addFollowUp = asyncHandler(async (req, res) => {
  const data = await leadService.addFollowUp(req.params.id, req.body, req.user?.name, requestScope(req))
  sendCreated(res, data, 'Follow-up added')
})

export const stats = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await leadService.stats(requestScope(req)) })
})
