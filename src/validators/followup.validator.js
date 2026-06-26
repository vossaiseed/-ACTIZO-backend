import { body } from 'express-validator'
import { FOLLOWUP_TYPES, FOLLOWUP_STATUSES } from '../config/constants.js'

export const createFollowUpRules = [
  body('leadId').isString().notEmpty().withMessage('leadId is required'),
  body('type').isIn(FOLLOWUP_TYPES).withMessage('Invalid follow-up type'),
  body('status').optional().isIn(FOLLOWUP_STATUSES),
  body('remark').optional().isString(),
]

export const updateFollowUpRules = [
  body('type').optional().isIn(FOLLOWUP_TYPES),
  body('status').optional().isIn(FOLLOWUP_STATUSES),
]
