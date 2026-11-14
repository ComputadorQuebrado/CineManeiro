import { Router } from 'express'
import { UserController } from '../controllers/UserController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)
router.get('/lists', UserController.getLists)
router.put('/lists/:type/:movieId', UserController.addToList)
router.delete('/lists/:type/:movieId', UserController.removeFromList)
export default router
