import { Router } from 'express'

import authRoutes from './auth.routes.js'
import userRoutes from './user.routes.js'
import staffRoutes from './staff.routes.js'
import branchRoutes from './branch.routes.js'
import productRoutes from './product.routes.js'
import leadRoutes from './lead.routes.js'
import followupRoutes from './followup.routes.js'
import saleRoutes from './sale.routes.js'
import targetRoutes from './target.routes.js'
import flashTargetRoutes from './flashTarget.routes.js'
import incentiveRoutes from './incentive.routes.js'
import financeRoutes from './finance.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import reportRoutes from './report.routes.js'
import activityRoutes from './activity.routes.js'
import notificationRoutes from './notification.routes.js'

const router = Router()

router.get('/', (_req, res) =>
  res.json({
    success: true,
    message: 'ACTIZO CRM API v1',
    endpoints: [
      'auth', 'users', 'branches', 'products', 'leads', 'follow-ups',
      'sales', 'targets', 'incentives', 'finance', 'dashboard', 'reports',
      'activities', 'notifications',
    ],
  }),
)

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/staff', staffRoutes)
router.use('/branches', branchRoutes)
router.use('/products', productRoutes)
router.use('/leads', leadRoutes)
router.use('/follow-ups', followupRoutes)
router.use('/sales', saleRoutes)
router.use('/targets', targetRoutes)
router.use('/flash-targets', flashTargetRoutes)
router.use('/incentives', incentiveRoutes)
router.use('/finance', financeRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/reports', reportRoutes)
router.use('/activities', activityRoutes)
router.use('/notifications', notificationRoutes)

export default router
