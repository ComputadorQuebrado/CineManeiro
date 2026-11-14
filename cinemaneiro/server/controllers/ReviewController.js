import { Review } from '../models/Review.js'
import { Movie } from '../models/Movie.js'

const filmeValido = id => typeof id === 'string' && /^tt\d{7,10}$/.test(id)

export const ReviewController = {
  list(req, res) {
    const movieId = req.params.movieId
    if (!filmeValido(movieId) || !Movie.findById(movieId)) return res.status(404).json({ error: 'Filme não encontrado.' })
    const resultado = Review.getByMovie(movieId)
    const myReview = req.session.userId ? Review.getByUserAndMovie(req.session.userId, movieId) || null : null
    res.json({ ...resultado, myReview })
  },

  createOrUpdate(req, res) {
    const movieId = req.params.movieId
    const score = req.body?.score
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : ''

    if (!filmeValido(movieId) || !Movie.findById(movieId)) return res.status(404).json({ error: 'Filme não encontrado.' })
    if (!Number.isInteger(score) || score < 0 || score > 10) return res.status(400).json({ error: 'A nota deve ser um número inteiro entre 0 e 10.' })
    if (!comment || comment.length > 1000) return res.status(400).json({ error: 'O comentário deve ter entre 1 e 1000 caracteres.' })

    try {
      const review = Review.save({ userId: req.session.userId, movieId, score, comment })
      res.json({ review, message: 'Avaliação salva com sucesso.' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Não foi possível salvar sua avaliação.' })
    }
  },

  remove(req, res) {
    const id = Number(req.params.reviewId)
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador de avaliação inválido.' })
    const result = Review.deleteById(id)
    if (!result.changes) return res.status(404).json({ error: 'Avaliação não encontrada.' })
    res.json({ ok: true })
  }
}
