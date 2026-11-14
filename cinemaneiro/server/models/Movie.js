import { db } from '../db.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
const cache = new Map() // Pra não ficar batendo no TMDB toda vez que abrir o mesmo filme.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function converterFilme(row) {
  if (!row) return null
  let generos = []
  try { generos = JSON.parse(row.genres || '[]') } catch {}
  return {
    id: row.id,
    titulo: row.title,
    ano: row.year,
    duracao: row.duration,
    nota: Number(row.rating) || 0,
    votos: Number(row.votes) || 0,
    generos,
    posicao: Number(row.position) || null
  }
}

async function tmdbRequest(endpoint) {
  const token = process.env.TMDB_ACCESS_TOKEN
  if (!token) return null

  const response = await fetch(`${TMDB_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(9000)
  })
  if (!response.ok) {
    const error = new Error(`TMDB respondeu com status ${response.status}.`)
    error.status = response.status
    throw error
  }
  return response.json()
}

function imageUrl(filePath, size = 'w780') {
  return filePath ? `${TMDB_IMAGE_BASE_URL}/${size}${filePath}` : null
}

export const Movie = {
  getAll() { // A tela pega os filmes daqui, direto do SQLite.
    return db.prepare('SELECT * FROM movies ORDER BY position, rating DESC, votes DESC, title COLLATE NOCASE').all().map(converterFilme)
  },

  findById(imdbId) {
    return converterFilme(db.prepare('SELECT * FROM movies WHERE id = ?').get(imdbId))
  },

  importMany(filmes) { // Atualiza o que já existe e adiciona os que ainda não estão no banco.
    const stmt = db.raw.prepare(`
      INSERT INTO movies (id, title, year, duration, rating, votes, genres, position, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        year = excluded.year,
        duration = excluded.duration,
        rating = excluded.rating,
        votes = excluded.votes,
        genres = excluded.genres,
        position = excluded.position,
        updated_at = CURRENT_TIMESTAMP
    `)
    db.raw.run('BEGIN TRANSACTION')
    try {
      filmes.forEach((filme, index) => {
        stmt.run([
          filme.id,
          filme.titulo,
          filme.ano ?? null,
          filme.duracao || null,
          Number(filme.nota) || 0,
          Number(filme.votos) || 0,
          JSON.stringify(filme.generos || []),
          index + 1
        ])
        stmt.reset()
      })
      stmt.free()
      db.raw.run('COMMIT')
      db.persist()
    } catch (error) {
      stmt.free()
      db.raw.run('ROLLBACK')
      throw error
    }
  },

  async getDetailsByImdbId(imdbId) {
    const cached = cache.get(imdbId)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    if (!process.env.TMDB_ACCESS_TOKEN) {
      return { configured: false, overview: '', tagline: '', genres: [], runtime: null, releaseDate: null, poster: null, backdrop: null, images: [], trailer: null, tmdbUrl: null }
    }

    const found = await tmdbRequest(`/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&language=pt-BR`)
    const match = found?.movie_results?.[0]
    if (!match?.id) {
      return { configured: true, overview: '', tagline: '', genres: [], runtime: null, releaseDate: null, poster: null, backdrop: null, images: [], trailer: null, tmdbUrl: null }
    }

    const query = new URLSearchParams({
      append_to_response: 'videos,images',
      language: 'pt-BR',
      include_image_language: 'pt,en,null'
    })
    const movie = await tmdbRequest(`/movie/${match.id}?${query.toString()}`)
    const videos = movie.videos?.results || []
    const trailer = videos
      .filter(video => video.site === 'YouTube' && video.type === 'Trailer' && video.key)
      .sort((a, b) => Number(b.official) - Number(a.official))[0]

    const imageFiles = [
      ...(movie.images?.backdrops || []).map(item => item.file_path),
      ...(movie.images?.posters || []).map(item => item.file_path)
    ].filter(Boolean)

    const value = {
      configured: true,
      overview: movie.overview || '',
      tagline: movie.tagline || '',
      genres: (movie.genres || []).map(genre => genre.name),
      runtime: movie.runtime || null,
      releaseDate: movie.release_date || null,
      poster: imageUrl(movie.poster_path, 'w500'),
      backdrop: imageUrl(movie.backdrop_path, 'w1280'),
      images: [...new Set(imageFiles)].slice(0, 12).map(file => imageUrl(file, 'w780')),
      trailer: trailer ? {
        name: trailer.name,
        embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}`,
        watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`
      } : null,
      tmdbUrl: `https://www.themoviedb.org/movie/${match.id}`
    }
    cache.set(imdbId, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  }
}
