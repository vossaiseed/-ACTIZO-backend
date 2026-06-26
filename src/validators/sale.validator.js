import { body } from 'express-validator'
import { PAYMENT_STATUS, PAYMENT_METHODS } from '../config/constants.js'

export const recordSaleRules = [
  body('customer').isString().trim().notEmpty().withMessage('Customer is required'),
  body('productId').optional({ nullable: true }).isString(),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('unitPrice').isNumeric().withMessage('Unit price must be a number'),
  body('discount').optional().isNumeric(),
  body('paymentStatus').optional().isIn(PAYMENT_STATUS),
  body('paymentMethod').optional().isIn(PAYMENT_METHODS),
]

export const updateSaleRules = [
  body('quantity').optional().isNumeric(),
  body('paymentStatus').optional().isIn(PAYMENT_STATUS),
  body('paymentMethod').optional().isIn(PAYMENT_METHODS),
]
