import { Router } from 'express'
import * as followupController from '../controllers/followup.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createFollowUpRules, updateFollowUpRules } from '../validators/followup.validator.js'

const router = Router()
router.use(authenticate)

router.get('/', followupController.list)
router.get('/upcoming', followupController.upcoming)
router.post('/', validate(createFollowUpRules), followupController.create)
router.patch('/:id', validate(updateFollowUpRules), followupController.update)
router.delete('/:id', followupController.remove)

export default router
