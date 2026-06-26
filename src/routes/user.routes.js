import { Router } from 'express'
import * as userController from '../controllers/user.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import { createUserRules, updateUserRules, statusRules } from '../validators/user.validator.js'

const router = Router()
router.use(authenticate)

// User management is limited to Admins and Branch Managers.
const manage = authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER)

router.get('/', manage, userController.list)
router.post('/', manage, validate(createUserRules), userController.create)
router.get('/:id', manage, userController.getOne)
router.patch('/:id', manage, validate(updateUserRules), userController.update)
router.patch('/:id/status', manage, validate(statusRules), userController.setStatus)
router.patch('/:id/reset-pin', manage, userController.resetPin)
router.delete('/:id', authorize(ROLES.ADMIN), userController.remove)

export default router
