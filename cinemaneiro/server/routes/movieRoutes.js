import { Router } from 'express'
import { MovieController } from '../controllers/MovieController.js'

const router = Router()
router.get('/', MovieController.list)
router.get('/:movieId/details', MovieController.details)
export default router
