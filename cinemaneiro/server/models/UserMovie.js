import { db } from '../db.js'

export const UserMovie = {
  getLists(userId) {
    const rows = db.prepare('SELECT movie_id, list_type FROM user_movies WHERE user_id = ?').all(userId)
    return {
      favorites: rows.filter(row => row.list_type === 'favorite').map(row => row.movie_id),
      watchLater: rows.filter(row => row.list_type === 'watch_later').map(row => row.movie_id)
    }
  },
  add(userId, movieId, listType) {
    return db.prepare('INSERT OR IGNORE INTO user_movies (user_id, movie_id, list_type) VALUES (?, ?, ?)').run(userId, movieId, listType)
  },
  remove(userId, movieId, listType) {
    return db.prepare('DELETE FROM user_movies WHERE user_id = ? AND movie_id = ? AND list_type = ?').run(userId, movieId, listType)
  }
}
