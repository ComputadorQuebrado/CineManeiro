import { UserMovie } from '../models/UserMovie.js'

const tiposDeLista = { favorite: 'favorite', watch_later: 'watch_later' }
const filmeValido = id => typeof id === 'string' && /^tt\d{7,10}$/.test(id)

export const UserController = {
  getLists(req, res) { // retorna a lista do usuário.
    res.json(UserMovie.getLists(req.session.userId))
  },
  addToList(req, res) { // Adiciona o filme em uma lista.
    const tipo = tiposDeLista[req.params.type]
    if (!tipo || !filmeValido(req.params.movieId)) return res.status(400).json({ error: 'Filme ou lista inválidos.' })
    UserMovie.add(req.session.userId, req.params.movieId, tipo)
    res.json({ ok: true })
  },
  removeFromList(req, res) { // Remove o filme de uma lista.
    const tipo = tiposDeLista[req.params.type]
    if (!tipo || !filmeValido(req.params.movieId)) return res.status(400).json({ error: 'Filme ou lista inválidos.' })
    UserMovie.remove(req.session.userId, req.params.movieId, tipo)
    res.json({ ok: true })
  }
}
