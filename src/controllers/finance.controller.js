import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/ApiResponse.js'
import * as financeService from '../services/finance.service.js'

export const overview = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await financeService.overview() })
})

export const charts = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await financeService.charts() })
})
