import { Router } from 'express'
import * as controller from '../controllers/flashTarget.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

// Read (role-scoped) — all roles.
router.get('/', controller.list)
router.get('/active-for-staff', controller.activeForStaff)

// Admin creates a flash campaign.
router.post('/', authorize(ROLES.ADMIN), controller.create)

// Branch Manager submits their branch request.
router.post('/:id/requests', authorize(ROLES.BRANCH_MANAGER, ROLES.ADMIN), controller.submitRequest)

// Admin approves / partially approves / rejects a branch request.
router.patch('/requests/:requestId', authorize(ROLES.ADMIN), controller.resolveRequest)

// Branch Manager distributes their approved quantity across staff.
router.put('/:id/staff', authorize(ROLES.BRANCH_MANAGER, ROLES.ADMIN), controller.distribute)

export default router
