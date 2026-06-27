import { Router } from 'express'
import * as controller from '../controllers/targetRequest.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

// Admin + Branch Manager can view (scoped); Branch Managers raise requests; only Admin resolves.
router.get('/', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), controller.list)
router.post('/', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), controller.create)
router.patch('/:id', authorize(ROLES.ADMIN), controller.resolve)

export default router
