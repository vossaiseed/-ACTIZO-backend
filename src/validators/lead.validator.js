import { body } from 'express-validator'
import { LEAD_STATUSES, LEAD_PRIORITIES, FOLLOWUP_TYPES, FOLLOWUP_STATUSES } from '../config/constants.js'

export const createLeadRules = [
  body('name').isString().trim().notEmpty().withMessage('Customer name is required'),
  body('mobile').optional().isString(),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('location').optional().isString(),
  body('productId').optional({ nullable: true }).isString(),
  body('branchId').optional({ nullable: true }).isString(),
  body('priority').optional().isIn(LEAD_PRIORITIES),
  body('value').optional().isNumeric(),
  body('expectedCloseDate').optional({ nullable: true }).isString(),
]

export const updateLeadRules = [
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('priority').optional().isIn(LEAD_PRIORITIES),
  body('value').optional().isNumeric(),
]

export const assignRules = [body('staffId').isString().notEmpty().withMessage('staffId is required')]

export const statusRules = [body('status').isIn(LEAD_STATUSES).withMessage('Invalid status')]

export const followUpRules = [
  body('type').isIn(FOLLOWUP_TYPES).withMessage('Invalid follow-up type'),
  body('status').optional().isIn(FOLLOWUP_STATUSES),
  body('remark').optional().isString(),
  body('date').optional().isString(),
  body('nextDate').optional({ nullable: true }).isString(),
]
