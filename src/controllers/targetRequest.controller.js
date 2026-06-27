import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as service from '../services/targetRequest.service.js'

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.list(requestScope(req)) })
})

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await service.create(req.body, req.user), 'Request submitted')
})

export const resolve = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await service.resolve(req.params.id, req.body, req.user), message: 'Request updated' })
})
