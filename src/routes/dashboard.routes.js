import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', dashboardController.overview)

export default router
