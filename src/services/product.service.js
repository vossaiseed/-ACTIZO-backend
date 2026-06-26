import * as productModel from '../models/product.model.js'
import { ApiError } from '../utils/ApiError.js'
import { parseListQuery, buildMeta } from '../utils/pagination.js'
import { PRODUCT_STATUS } from '../config/constants.js'

const today = () => new Date().toISOString().slice(0, 10)

export async function list(query) {
  const q = parseListQuery(query)
  const { data, count } = await productModel.findAll({
    category: query.category,
    status: query.status,
    search: q.search,
    sort: q.sort,
    order: q.order,
    from: q.from,
    to: q.to,
  })
  return { data, meta: buildMeta({ page: q.page, limit: q.limit, total: count }) }
}

export async function getById(id) {
  const product = await productModel.findById(id)
  if (!product) throw ApiError.notFound('Product not found')
  const salesHistory = await productModel.salesHistory(id)
  return { ...product, salesHistory }
}

export async function create(payload) {
  return productModel.create({
    code: payload.code,
    name: payload.name,
    brand: payload.brand || null,
    category: payload.category,
    unit: payload.unit || 'PCS',
    price: payload.price ?? 0,
    status: payload.status || 'Active',
    type: payload.type || 'General',
    description: payload.description || '',
    created_date: today(),
  })
}

export async function update(id, payload) {
  await getById(id)
  const fields = {}
  const map = {
    code: 'code',
    name: 'name',
    brand: 'brand',
    category: 'category',
    unit: 'unit',
    price: 'price',
    status: 'status',
    type: 'type',
    description: 'description',
  }
  for (const [k, col] of Object.entries(map)) if (payload[k] !== undefined) fields[col] = payload[k]
  return productModel.update(id, fields)
}

export async function setStatus(id, status) {
  if (!PRODUCT_STATUS.includes(status)) throw ApiError.badRequest('Invalid product status')
  const product = await productModel.findById(id)
  if (!product) throw ApiError.notFound('Product not found')
  return productModel.update(id, { status })
}

export async function remove(id) {
  await getById(id)
  return productModel.remove(id)
}
