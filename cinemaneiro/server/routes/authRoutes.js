import { Router } from 'express'
import { AuthController } from '../controllers/AuthController.js'

export function createAuthRoutes(authLimiter) {
  const router = Router()
  router.get('/me', AuthController.me)
  router.post('/register', authLimiter, AuthController.register)
  router.post('/register-admin', authLimiter, AuthController.registerAdmin)
  router.post('/login', authLimiter, AuthController.login)
  router.post('/logout', AuthController.logout)
  return router
}
