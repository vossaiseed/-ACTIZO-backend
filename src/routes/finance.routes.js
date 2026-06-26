import { Router } from 'express'
import * as financeController from '../controllers/finance.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

// Finance is admin-only in the frontend nav.
router.get('/overview', authorize(ROLES.ADMIN), financeController.overview)
router.get('/charts', authorize(ROLES.ADMIN), financeController.charts)

export default router
