import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { branchScope } from '../middleware/rbac.js'
import * as userService from '../services/user.service.js'

export const list = asyncHandler(async (req, res) => {
  const scope = {}
  const bs = branchScope(req)
  if (bs) scope.branchId = bs
  const { data, meta } = await userService.list(req.query, scope)
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await userService.getById(req.params.id) })
})

export const create = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body, req.user)
  sendCreated(res, user, 'User created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await userService.update(req.params.id, req.body), message: 'User updated' })
})

export const setStatus = asyncHandler(async (req, res) => {
  const data = await userService.setStatus(req.params.id, req.body.status)
  sendSuccess(res, { data, message: 'User status updated' })
})

export const resetPin = asyncHandler(async (req, res) => {
  const data = await userService.resetPin(req.params.id)
  sendSuccess(res, { data, message: 'PIN reset' })
})

export const remove = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id)
  sendSuccess(res, { message: 'User deleted' })
})
