import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import * as notificationService from '../services/notification.service.js'

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await notificationService.list(req.user.id, req.query)
  sendSuccess(res, { data, meta })
})

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await notificationService.create(req.body), 'Notification created')
})

export const markRead = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await notificationService.markRead(req.params.id), message: 'Marked as read' })
})

export const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id)
  sendSuccess(res, { message: 'All notifications marked as read' })
})
