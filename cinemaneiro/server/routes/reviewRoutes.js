import { Router } from 'express'
import { ReviewController } from '../controllers/ReviewController.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()
router.get('/movie/:movieId', ReviewController.list)
router.post('/movie/:movieId', requireAuth, ReviewController.createOrUpdate)
router.delete('/:reviewId', requireAdmin, ReviewController.remove)
export default router
