import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import * as activityService from '../services/activity.service.js'

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await activityService.list(req.query)
  sendSuccess(res, { data, meta })
})

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await activityService.create({ ...req.body, userId: req.body.userId || req.user?.id }), 'Activity logged')
})
