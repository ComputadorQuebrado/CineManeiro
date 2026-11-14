import { User } from '../models/User.js'

export function requireAuth(req, res, next) { // Conferidor de sessão.
  if (!req.session.userId) return res.status(401).json({ error: 'Faça login para continuar.' })
  next()
}

export function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Faça login para continuar.' })
  const user = User.findById(req.session.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Somente administradores podem realizar esta ação.' })
  }
  next()
}
