import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

router.get('/', notificationController.list)
router.patch('/read-all', notificationController.markAllRead)
router.patch('/:id/read', notificationController.markRead)
router.post('/', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), notificationController.create)

export default router
