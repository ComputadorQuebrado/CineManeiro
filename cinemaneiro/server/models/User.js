import { db } from '../db.js'

export const User = {
  findById(id) {
    return db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(id)
  },
  findForLogin(identifier) {
    return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE').get(identifier, identifier)
  },
  hasAdmin() {
    return Boolean(db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get())
  },
  create({ username, email, passwordHash, role = 'user' }) {
    return db.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(username, email, passwordHash, role)
  }
}

export function publicUser(user) { // Preparar os dados de usuário antes de mandar pro front. Em resumo, tira a senha.
  return { id: user.id, usuario: user.username, email: user.email, role: user.role }
}
