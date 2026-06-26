import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js'
import { PRODUCT_CATEGORIES } from '../config/constants.js'
import * as productService from '../services/product.service.js'

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await productService.list(req.query)
  sendSuccess(res, { data, meta })
})

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await productService.getById(req.params.id) })
})

export const create = asyncHandler(async (req, res) => {
  const product = await productService.create(req.body)
  sendCreated(res, product, 'Product created')
})

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await productService.update(req.params.id, req.body), message: 'Product updated' })
})

export const setStatus = asyncHandler(async (req, res) => {
  const data = await productService.setStatus(req.params.id, req.body.status)
  sendSuccess(res, { data, message: 'Status updated' })
})

export const remove = asyncHandler(async (req, res) => {
  await productService.remove(req.params.id)
  sendSuccess(res, { message: 'Product deleted' })
})

export const categories = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: PRODUCT_CATEGORIES })
})
