import { body } from 'express-validator'

// Staff are always role='staff' (forced by the service), so role is not required.
export const createStaffRules = [
  body('name').isString().trim().notEmpty().withMessage('Full name is required'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('phone').optional({ nullable: true }).isString(),
  body('pin').optional().matches(/^\d{6}$/).withMessage('PIN must be 6 digits'),
  body('branchId').optional({ nullable: true }).isString(),
]

export const updateStaffRules = [
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional({ nullable: true }).isEmail(),
  body('phone').optional({ nullable: true }).isString(),
  body('status').optional().isIn(['active', 'inactive']),
  body('pin').optional().matches(/^\d{6}$/),
]
