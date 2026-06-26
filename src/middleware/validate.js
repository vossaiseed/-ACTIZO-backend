import { validationResult } from 'express-validator'
import { ApiError } from '../utils/ApiError.js'

/**
 * Runs express-validator chains and throws a 400 with field details if invalid.
 * Usage: router.post('/', validate(createLeadRules), controller.create)
 */
export const validate = (rules = []) => [
  ...rules,
  (req, _res, next) => {
    const result = validationResult(req)
    if (result.isEmpty()) return next()
    const details = result.array().map((e) => ({ field: e.path, message: e.msg }))
    next(ApiError.badRequest('Validation failed', details))
  },
]

export default validate
