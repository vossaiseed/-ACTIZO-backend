import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as dashboardService from '../services/dashboard.service.js'

export const overview = asyncHandler(async (req, res) => {
  // Admin -> all; Branch Manager -> their branch; Staff -> their own records.
  sendSuccess(res, { data: await dashboardService.overview(requestScope(req)) })
})
