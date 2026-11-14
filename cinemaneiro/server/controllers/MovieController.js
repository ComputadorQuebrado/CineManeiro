import { Movie } from '../models/Movie.js'

export const MovieController = {
  list(_req, res) { // Manda o catálogo que está salvo no banco.
    res.json({ filmes: Movie.getAll() })
  },

  async details(req, res) {
    const movieId = req.params.movieId
    if (!/^tt\d{7,10}$/.test(movieId)) return res.status(400).json({ error: 'Identificador de filme inválido.' })
    if (!Movie.findById(movieId)) return res.status(404).json({ error: 'Filme não encontrado no catálogo.' })

    try {
      res.json(await Movie.getDetailsByImdbId(movieId))
    } catch (error) {
      console.error('Deu ruim consultando o TMDB:', error.message)
      res.status(502).json({ error: 'Não foi possível carregar as informações externas do filme agora.' })
    }
  }
}
