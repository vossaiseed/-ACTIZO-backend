import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { branchScope } from '../middleware/rbac.js'
import * as staffService from '../services/staff.service.js'

export const list = asyncHandler(async (req, res) => {
  const scope = {}
  const bs = branchScope(req)
  if (bs) scope.branchId = bs
  const { data, meta } = await staffService.list(req.query, scope)
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await staffService.getById(req.params.id) })
})

export const create = asyncHandler(async (req, res) => {
  const staff = await staffService.create(req.body, req.user)
  sendCreated(res, staff, 'Staff member created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await staffService.update(req.params.id, req.body), message: 'Staff updated' })
})

export const setStatus = asyncHandler(async (req, res) => {
  const data = await staffService.setStatus(req.params.id, req.body.status)
  sendSuccess(res, { data, message: 'Staff status updated' })
})

export const resetPin = asyncHandler(async (req, res) => {
  const data = await staffService.resetPin(req.params.id)
  sendSuccess(res, { data, message: 'PIN reset' })
})

export const remove = asyncHandler(async (req, res) => {
  await staffService.remove(req.params.id)
  sendSuccess(res, { message: 'Staff deleted' })
})
