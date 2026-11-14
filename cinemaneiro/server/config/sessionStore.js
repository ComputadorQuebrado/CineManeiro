import session from 'express-session'
import { db } from '../db.js'

class SqliteSessionStore extends session.Store { // Armazenamento de sessões do SQLite
  get(sid, callback) { // Busca a sessão
    try {
      const row = db.prepare('SELECT sess FROM sessions WHERE sid = ?').get(sid)
      callback(null, row ? JSON.parse(row.sess) : null) // Se encontrar, transforma o conteúdo JSON em objeto, senão, null neles.
    } catch (error) { callback(error) }
  }

  set(sid, sess, callback = () => {}) { // Salva a sessão no db
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : null // obrigado mais uma vez ChatGpt pela ajuda, aqui, ele me recomendou trabalhar com cookies.
                                                                                            // Aqui acontece o controle do tempo de validade da sessão no cookie.
      db.prepare(`
        INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
      `).run(sid, JSON.stringify(sess), expires) // ON CONFLICT garante que não hajam duplicatas das sessões.
      callback(null)
    } catch (error) { callback(error) }
  }

  destroy(sid, callback = () => {}) { // Remover sessões do banco.
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid)
      callback(null)
    } catch (error) { callback(error) }
  }

  touch(sid, sess, callback = () => {}) { // Aqui é um PUT basicamente, só atualiza o banco.
    this.set(sid, sess, callback)
  }
}

export function createSessionStore() {
  return new SqliteSessionStore()
}
