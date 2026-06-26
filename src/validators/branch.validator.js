import { body } from 'express-validator'

export const createBranchRules = [
  body('code').isString().trim().notEmpty().withMessage('Branch code is required'),
  body('name').isString().trim().notEmpty().withMessage('Branch name is required'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email'),
  body('region').optional().isString(),
]

export const updateBranchRules = [
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional({ nullable: true }).isEmail(),
  body('targetRevenue').optional().isNumeric().withMessage('Target revenue must be a number'),
  body('monthlyTarget').optional().isNumeric().withMessage('Monthly target must be a number'),
]
