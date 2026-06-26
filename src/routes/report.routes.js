import { Router } from 'express'
import * as reportController from '../controllers/report.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

// Reports available to Admin & Branch Manager.
router.get('/:type', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), reportController.getReport)

export default router
