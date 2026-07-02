import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as branchService from '../services/branch.service.js'

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await branchService.list(req.query, requestScope(req))
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await branchService.getById(req.params.id, requestScope(req)) })
})

export const stats = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await branchService.getStats(req.params.id, requestScope(req)) })
})

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await branchService.create(req.body), 'Branch created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await branchService.update(req.params.id, req.body, requestScope(req)), message: 'Branch updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await branchService.remove(req.params.id)
  sendSuccess(res, { message: 'Branch deleted' })
})
