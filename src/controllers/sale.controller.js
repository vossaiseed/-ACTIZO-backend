import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { requestScope } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'
import * as saleService from '../services/sale.service.js'

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await saleService.list(req.query, requestScope(req))
  sendSuccess(res, { data, meta })
})

export const stats = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await saleService.stats(requestScope(req)) })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await saleService.getById(req.params.id) })
})

export const create = asyncHandler(async (req, res) => {
  // Staff record sales against themselves by default.
  const payload = { ...req.body }
  if (req.user?.role === ROLES.STAFF) {
    payload.staffId = payload.staffId || req.user.id
    payload.branchId = payload.branchId || req.user.branchId
  }
  sendCreated(res, await saleService.create(payload), 'Sale recorded')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await saleService.update(req.params.id, req.body), message: 'Sale updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await saleService.remove(req.params.id)
  sendSuccess(res, { message: 'Sale deleted' })
})
