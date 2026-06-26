import { Router } from 'express'
import * as productController from '../controllers/product.controller.js'
import { authenticate } from '../middleware/auth.js'
import { authorize } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import {
  createProductRules,
  updateProductRules,
  statusRules,
} from '../validators/product.validator.js'

const router = Router()
router.use(authenticate)

router.get('/', productController.list)
router.get('/categories', productController.categories)
router.get('/:id', productController.getOne)

router.post('/', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), validate(createProductRules), productController.create)
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), validate(updateProductRules), productController.update)
router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.BRANCH_MANAGER), validate(statusRules), productController.setStatus)
router.delete('/:id', authorize(ROLES.ADMIN), productController.remove)

export default router
