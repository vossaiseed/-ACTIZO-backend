import { body } from 'express-validator'
import { ROLE_VALUES } from '../config/constants.js'

export const loginRules = [
  body('role').isIn(ROLE_VALUES).withMessage('A valid role is required'),
  body('pin')
    .isString()
    .matches(/^\d{6}$/)
    .withMessage('PIN must be exactly 6 digits'),
  body('identifier').optional().isString(),
]

export const refreshRules = [body('refreshToken').isString().notEmpty().withMessage('refreshToken is required')]
