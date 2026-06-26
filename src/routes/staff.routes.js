import { Router } from 'express'
import * as staffController from '../controllers/staff.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import { statusRules } from '../validators/user.validator.js'
import { createStaffRules, updateStaffRules } from '../validators/staff.validator.js'

const router = Router()
router.use(authenticate)

// Staff management mirrors user management: Admins + Branch Managers.
const manage = authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER)

router.get('/', manage, staffController.list)
router.post('/', manage, validate(createStaffRules), staffController.create)
router.get('/:id', manage, staffController.getOne)
router.patch('/:id', manage, validate(updateStaffRules), staffController.update)
router.patch('/:id/status', manage, validate(statusRules), staffController.setStatus)
router.patch('/:id/reset-pin', manage, staffController.resetPin)
router.delete('/:id', authorize(ROLES.ADMIN), staffController.remove)

export default router
