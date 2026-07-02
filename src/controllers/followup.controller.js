import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as followupService from '../services/followup.service.js'

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await followupService.list(req.query, requestScope(req))
  sendSuccess(res, { data, meta })
})

export const upcoming = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await followupService.upcoming(Number(req.query.limit) || 8, requestScope(req)) })
})

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await followupService.create(req.body, req.user?.name, requestScope(req)), 'Follow-up created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await followupService.update(req.params.id, req.body, requestScope(req)), message: 'Follow-up updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await followupService.remove(req.params.id, requestScope(req))
  sendSuccess(res, { message: 'Follow-up deleted' })
})
