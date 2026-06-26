import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { branchScope } from '../middleware/rbac.js'
import { ApiError } from '../utils/ApiError.js'
import { ROLES } from '../config/constants.js'
import * as targetService from '../services/target.service.js'

export const summary = asyncHandler(async (req, res) => {
  const scope = {}
  const bs = branchScope(req)
  if (bs) scope.branchId = bs
  sendSuccess(res, { data: await targetService.summary(scope) })
})

export const list = asyncHandler(async (req, res) => {
  const scope = {}
  const bs = branchScope(req)
  if (bs) scope.branchId = bs
  const { data, meta } = await targetService.list(req.params.tab, req.query, scope)
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await targetService.getById(req.params.tab, req.params.id) })
})

export const create = asyncHandler(async (req, res) => {
  // 'general' = Product Target (Admin only). special/project keep the generic create.
  if (req.params.tab === 'general') {
    if (req.user?.role !== ROLES.ADMIN) throw ApiError.forbidden('Only an Admin can create product targets')
    return sendCreated(res, await targetService.createProductTarget(req.body), 'Product target created')
  }
  sendCreated(res, await targetService.create(req.params.tab, req.body), 'Target created')
})

export const allocateBranches = asyncHandler(async (req, res) => {
  const data = await targetService.allocateBranches(req.params.id, req.body.allocations || [])
  sendSuccess(res, { data, message: 'Branch allocations saved' })
})

export const allocateStaff = asyncHandler(async (req, res) => {
  const scope = {}
  const bs = branchScope(req)
  if (bs) scope.branchId = bs
  const data = await targetService.allocateStaff(req.params.id, req.body.allocations || [], scope)
  sendSuccess(res, { data, message: 'Staff allocations saved' })
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await targetService.update(req.params.tab, req.params.id, req.body), message: 'Target updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await targetService.remove(req.params.tab, req.params.id)
  sendSuccess(res, { message: 'Target deleted' })
})
