import { Router } from 'express'
import * as targetController from '../controllers/target.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

const manage = authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER)
const TAB = ':tab(general|special|project)'

router.get('/summary', targetController.summary)

// Hierarchical allocation workflow (Product → Branch → Staff)
router.put('/product/:id/branches', authorize(ROLES.ADMIN), targetController.allocateBranches)
router.put('/branch/:id/staff', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), targetController.allocateStaff)

router.get(`/${TAB}`, targetController.list)
router.post(`/${TAB}`, manage, targetController.create) // general create is Admin-gated in the controller
router.get(`/${TAB}/:id`, targetController.getOne)
router.patch(`/${TAB}/:id`, manage, targetController.update)
router.delete(`/${TAB}/:id`, manage, targetController.remove)

export default router
