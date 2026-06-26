import { body } from 'express-validator'
import { PRODUCT_CATEGORIES, PRODUCT_STATUS } from '../config/constants.js'

export const createProductRules = [
  body('name').isString().trim().notEmpty().withMessage('Product name is required'),
  body('code').isString().trim().notEmpty().withMessage('Product code is required'),
  body('category').isIn(PRODUCT_CATEGORIES).withMessage('Invalid category'),
  body('price').isNumeric().withMessage('Price is required'),
  body('brand').optional({ nullable: true }).isString(),
  body('unit').optional().isString(),
  body('status').optional().isIn(PRODUCT_STATUS).withMessage('Invalid status'),
  body('description').optional({ nullable: true }).isString(),
]

export const updateProductRules = [
  body('name').optional().isString().trim().notEmpty(),
  body('code').optional().isString().trim().notEmpty(),
  body('category').optional().isIn(PRODUCT_CATEGORIES).withMessage('Invalid category'),
  body('price').optional().isNumeric(),
  body('brand').optional({ nullable: true }).isString(),
  body('unit').optional().isString(),
  body('status').optional().isIn(PRODUCT_STATUS).withMessage('Invalid status'),
  body('description').optional({ nullable: true }).isString(),
]

export const statusRules = [body('status').isIn(PRODUCT_STATUS).withMessage('Invalid status')]
