import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as service from '../services/flashTarget.service.js'

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.list(requestScope(req)) })
})

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await service.createCampaign(req.body, req.user), 'Flash target created')
})

export const submitRequest = asyncHandler(async (req, res) => {
  sendCreated(res, await service.submitBranchRequest(req.params.id, req.body, req.user), 'Request submitted')
})

export const resolveRequest = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await service.resolveBranchRequest(req.params.requestId, req.body, req.user),
    message: 'Request updated',
  })
})

export const distribute = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await service.distributeToStaff(req.params.id, req.body.allocations || [], req.user),
    message: 'Distributed to staff',
  })
})

export const activeForStaff = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.activeForStaff(req.user.id) })
})

export const active = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await service.activeCampaigns() })
})
