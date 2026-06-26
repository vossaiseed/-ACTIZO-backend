import { Router } from 'express'
import * as incentiveController from '../controllers/incentive.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Read-only: incentives are derived automatically from targets + sales (no manual entry/edit).
router.get('/', incentiveController.list)
router.get('/history', incentiveController.history)
router.get('/summary', incentiveController.summary)

export default router
