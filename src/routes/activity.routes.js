import { Router } from 'express'
import * as activityController from '../controllers/activity.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', activityController.list)
router.post('/', activityController.create)

export default router
