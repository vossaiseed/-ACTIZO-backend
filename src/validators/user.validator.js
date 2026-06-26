import { body } from 'express-validator'
import { ROLES } from '../config/constants.js'

export const createUserRules = [
  body('name').isString().trim().notEmpty().withMessage('Full name is required'),
  body('role').isIn([ROLES.STAFF, ROLES.BRANCH_MANAGER, ROLES.ADMIN]).withMessage('Invalid role'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('pin').optional().matches(/^\d{6}$/).withMessage('PIN must be 6 digits'),
  body('branchId').optional({ nullable: true }).isString(),
]

export const updateUserRules = [
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional({ nullable: true }).isEmail(),
  body('status').optional().isIn(['active', 'inactive']),
  body('pin').optional().matches(/^\d{6}$/),
]

export const statusRules = [body('status').isIn(['active', 'inactive']).withMessage('Invalid status')]
