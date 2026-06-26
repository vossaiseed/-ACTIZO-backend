import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import * as reportService from '../services/report.service.js'

export const getReport = asyncHandler(async (req, res) => {
  const data = await reportService.generate(req.params.type, requestScope(req))
  sendSuccess(res, { data })
})
