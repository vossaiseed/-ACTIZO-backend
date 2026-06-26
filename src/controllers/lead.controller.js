import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { branchScope } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'
import * as leadService from '../services/lead.service.js'

export const list = asyncHandler(async (req, res) => {
  // Staff see only their own leads; managers their branch; admin all.
  const scope = {}
  const bs = branchScope(req)
  if (bs) scope.branchId = bs
  if (req.user?.role === ROLES.STAFF) scope.staffId = req.user.id
  const { data, meta } = await leadService.list(req.query, scope)
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await leadService.getById(req.params.id) })
})

export const create = asyncHandler(async (req, res) => {
  const lead = await leadService.create(req.body, req.user?.name || 'System')
  sendCreated(res, lead, 'Lead created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await leadService.update(req.params.id, req.body), message: 'Lead updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await leadService.remove(req.params.id)
  sendSuccess(res, { message: 'Lead deleted' })
})

export const assign = asyncHandler(async (req, res) => {
  const data = await leadService.assignStaff(req.params.id, req.body.staffId, req.body.staffName)
  sendSuccess(res, { data, message: 'Lead assigned' })
})

export const updateStatus = asyncHandler(async (req, res) => {
  const data = await leadService.updateStatus(req.params.id, req.body.status, req.user?.name)
  sendSuccess(res, { data, message: 'Status updated' })
})

export const addFollowUp = asyncHandler(async (req, res) => {
  const data = await leadService.addFollowUp(req.params.id, req.body, req.user?.name)
  sendCreated(res, data, 'Follow-up added')
})

export const stats = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await leadService.stats() })
})
