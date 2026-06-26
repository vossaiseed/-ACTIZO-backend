import { Router } from 'express'
import * as branchController from '../controllers/branch.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import { createBranchRules, updateBranchRules } from '../validators/branch.validator.js'

const router = Router()
router.use(authenticate)

router.get('/', branchController.list)
router.get('/:id', branchController.getOne)
router.get('/:id/stats', branchController.stats)
router.post('/', authorize(ROLES.ADMIN), validate(createBranchRules), branchController.create)
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), validate(updateBranchRules), branchController.update)
router.delete('/:id', authorize(ROLES.ADMIN), branchController.remove)

export default router
