/**
 * Parse standard list query params: ?page=1&limit=10&sort=createdAt&order=desc&search=...
 */
export function parseListQuery(query = {}, { defaultSort = 'created_at', maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || 10))
  const sort = query.sort || defaultSort
  const order = (query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  const search = (query.search || '').trim()
  return {
    page,
    limit,
    sort,
    order,
    search,
    from: (page - 1) * limit,
    to: page * limit - 1,
  }
}

/** Build the meta block for a paginated response. */
export function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total: total ?? 0,
    totalPages: Math.max(1, Math.ceil((total ?? 0) / limit)),
  }
}

export default { parseListQuery, buildMeta }
