import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as incentiveService from '../services/incentive.service.js'

// Incentives are computed live from Staff targets + completed sales — read-only, role-scoped.
export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await incentiveService.list(req.query, requestScope(req))
  sendSuccess(res, { data, meta })
})

export const history = asyncHandler(async (req, res) => {
  const { data, meta } = await incentiveService.history(req.query, requestScope(req))
  sendSuccess(res, { data, meta })
})

export const summary = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await incentiveService.summary(requestScope(req)) })
})
