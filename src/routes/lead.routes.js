import { Router } from 'express'
import * as leadController from '../controllers/lead.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import {
  createLeadRules,
  updateLeadRules,
  assignRules,
  statusRules,
  followUpRules,
} from '../validators/lead.validator.js'

const router = Router()
router.use(authenticate)

router.get('/', leadController.list)
router.get('/stats', leadController.stats)
router.post('/', validate(createLeadRules), leadController.create)
router.get('/:id', leadController.getOne)
router.patch('/:id', validate(updateLeadRules), leadController.update)
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), leadController.remove)

// workflow actions
router.patch('/:id/assign', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), validate(assignRules), leadController.assign)
router.patch('/:id/status', validate(statusRules), leadController.updateStatus)
router.post('/:id/follow-ups', validate(followUpRules), leadController.addFollowUp)

export default router
