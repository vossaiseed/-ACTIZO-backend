import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { validate } from '../middleware/validate.js'
import { authenticate } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { loginRules, refreshRules } from '../validators/auth.validator.js'

const router = Router()

router.post('/login', authLimiter, validate(loginRules), authController.login)
router.post('/refresh', validate(refreshRules), authController.refresh)
router.post('/logout', authenticate, authController.logout)
router.get('/me', authenticate, authController.me)

export default router
