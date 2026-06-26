import { Router } from 'express'
import * as saleController from '../controllers/sale.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import { recordSaleRules, updateSaleRules } from '../validators/sale.validator.js'

const router = Router()
router.use(authenticate)

router.get('/', saleController.list)
router.get('/stats', saleController.stats)
router.post('/', validate(recordSaleRules), saleController.create)
router.get('/:id', saleController.getOne)
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), validate(updateSaleRules), saleController.update)
router.delete('/:id', authorize(ROLES.ADMIN), saleController.remove)

export default router
