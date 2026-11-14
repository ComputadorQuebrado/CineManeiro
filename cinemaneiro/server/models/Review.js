import { db } from '../db.js'

const campos = `r.id, r.movie_id AS movieId, r.user_id AS userId, u.username AS username, r.score, r.comment, r.created_at AS createdAt`

export const Review = {
  getByMovie(movieId) {
    const reviews = db.prepare(`
      SELECT ${campos} FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.movie_id = ?
      ORDER BY r.created_at DESC, r.id DESC
    `).all(movieId)
    const resumo = db.prepare('SELECT COUNT(*) AS count, AVG(score) AS average FROM reviews WHERE movie_id = ?').get(movieId)
    return {
      reviews,
      count: Number(resumo?.count || 0),
      average: resumo?.average == null ? null : Number(Number(resumo.average).toFixed(1))
    }
  },
  getByUserAndMovie(userId, movieId) {
    return db.prepare(`SELECT ${campos} FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.user_id = ? AND r.movie_id = ?`).get(userId, movieId)
  },
  save({ userId, movieId, score, comment }) { // Uma avaliação por pessoa pra cada filme, sem duplicar tudo.
    db.prepare(`
      INSERT INTO reviews (user_id, movie_id, score, comment) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, movie_id) DO UPDATE SET
        score = excluded.score,
        comment = excluded.comment,
        created_at = CURRENT_TIMESTAMP
    `).run(userId, movieId, score, comment)
    return this.getByUserAndMovie(userId, movieId)
  },
  deleteById(id) {
    return db.prepare('DELETE FROM reviews WHERE id = ?').run(id)
  }
}
