import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'

const app = express() // Não entendi muito bem como o express() funciona, mas precisa dele. Só sei que precisa dele pra fazer as rotas.

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
      db.prepare(`INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired`) // ON CONFLICT garante que não hajam duplicatas das sessões.
        .run(sid, JSON.stringify(sess), expires)
      callback(null)
    } catch (error) { callback(error) }
  }
  destroy(sid, callback = () => {}) { // Remover sessões do banco.
    try { db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); callback(null) }
    catch (error) { callback(error) }
  }
  touch(sid, sess, callback = () => {}) { this.set(sid, sess, callback) } // Aqui, é um PUT basicamente, só atualiza o banco.
}
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER
)`) // Criando a tabela de sessões no db caso tenha sido apagada ou ainda não tenha sido criada.


const sessionStore = new SqliteSessionStore()
const PORT = Number(process.env.PORT || 3001)
const isProduction = process.env.NODE_ENV === 'production'
const SESSION_SECRET = process.env.SESSION_SECRET
const ADMIN_INVITE_TOKEN = process.env.ADMIN_INVITE_TOKEN

// Configuraçõezinhas do servidor, estou usando o .env pra guardar elas.

if (!SESSION_SECRET || SESSION_SECRET.length < 32) { // pelo que entendi, 32 caracteres é o mínimo de segurança recomendado pra isso, vou seguir.
  throw new Error('SESSION_SECRET no .env não definida ou menor do que 32 caracteres.')
}
if (!ADMIN_INVITE_TOKEN || ADMIN_INVITE_TOKEN.length < 24) {
  throw new Error('ADMIN_INVITE_TOKEN no .env não definida ou menor do que 24 caracteres.')
}

if (isProduction) app.set('trust proxy', 1)

app.use(helmet({  // Mais uma ajuda do Gpt, Perguntei pra ele se tinha alguma maneira boa pra carregar coisas de sites alheios, e ele me recomendou usar o helmet como Middleware.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'https://images.metahub.space', 'https://placehold.co', 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}))

// Em resumo, o helmet evita que coisas de sites não colocados na whitelist acessem o site. Eu pessoalmente achei bem legal então vou usar, por mais que nesse caso seja inútil.

app.use(express.json({ limit: '20kb' })) // Limitar as requisições em 20kb e permitir que o express use JSON.
db.prepare('DELETE FROM sessions WHERE expired IS NOT NULL AND expired < ?').run(Date.now()) // E mais uma vez, Gpt recomendou limpar as sessões expiradas do banco de dados.

app.use(session({
  name: 'cinemaneiro.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))

// Mais um middleware, dessa vez, serve pra manter o usuário autenticado durante as requisições.

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'}
})

// Outra dica do Gpt, limitar tentativas para evitar DDOS

const cleanUser = (user) => ({ // Preparar os dados de usuário antes de mandar pro front. Em resumo, tira a senha.
  id: user.id,
  usuario: user.username,
  email: user.email,
  role: user.role
})

function requireAuth(req, res, next) { // Conferidor de sessão.
  if (!req.session.userId) return res.status(401).json({ error: 'Faça login para continuar.' })
  next()
}

function validCredentials({ usuario, email, senha }) { // Validador de solicitação de login.
  if (typeof usuario !== 'string' || usuario.trim().length < 3 || usuario.trim().length > 30) {
    return 'O tamanho de usuário deve ser entre 3 e 30 caracteres.'
  }
  if (!/^[\p{L}\p{N}_.-]+$/u.test(usuario.trim())) {
    return 'O usuário pode conter somente letras, números e (., -, _).'
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
    return 'Informe um e-mail válido.'
  }
  if (typeof senha !== 'string' || senha.length < 8 || senha.length > 72) {
    return 'A senha deve ter entre 8 e 72 caracteres.'
  }
  return null
}

function safeTokenEqual(candidate, expected) { // Aqui confere se o token de admin bate.
  if (typeof candidate !== 'string') return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

app.get('/api/health', (_req, res) => res.json({ ok: true })) // teste de vida do servidor, se retornar ok é pq tá rodando.

app.get('/api/auth/me', (req, res) => { // verifica se o usuario está logado
  if (!req.session.userId) return res.json({ user: null })
  const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(req.session.userId) // se tiver id de sessão, monta o user a partir dele.
  if (!user) { // senão
    req.session.destroy(() => {}) // destrói a sessão.
    return res.json({ user: null }) // retorna nulo.
  }
  res.json({ user: cleanUser(user) }) // limpa o user usando a função clean e manda ele de volta como json.
})

app.post('/api/auth/register', authLimiter, async (req, res) => { // registrando o usuário.
  const { usuario, email, senha } = req.body ?? {} // recebe
  const validation = validCredentials({ usuario, email, senha }) // valida
  if (validation) return res.status(400).json({ error: validation }) // tratamento de erro

  try {
    const hash = await bcrypt.hash(senha, 12) // criptografa a senha
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)' // monta o query pro sql
    ).run(usuario.trim(), email.trim().toLowerCase(), hash, 'user') // insere, 'user' garante que não seja admin.
    req.session.userId = Number(result.lastInsertRowid) // cria a sessão
    const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(req.session.userId) // confere se entrou no db
    res.status(201).json({ user: cleanUser(user) }) // retorna a sessão com created.
  } catch (error) {
    if (String(error.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Esse usuário ou e-mail já está cadastrado.' }) // se deu erro no sql, é pq algo repetiu (com exceção da senha obviamente).
    }
    console.error(error)
    res.status(500).json({ error: 'Não foi possível criar a conta.' }) // E se deu 500, algo de errado não está certo.
  }
})

app.post('/api/auth/register-admin', authLimiter, async (req, res) => {
  // Este link serve para o primeiro administrador; impede novos admins
  // mesmo que alguém reutilize o link depois do cadastro inicial.
  const adminExists = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get() // se tem admin cadastrado já, bloqueia o convite.
  if (adminExists) {
    return res.status(404).json({ error: 'Convite administrativo indisponível.' })
  }
  if (!safeTokenEqual(req.body?.inviteToken, ADMIN_INVITE_TOKEN)) {
    return res.status(404).json({ error: 'Página não encontrada ou convite inválido.' }) // caso o convite seja inválido.
  }
  const { usuario, email, senha } = req.body ?? {} // se tudo estiver ok, monta o corpo
  const validation = validCredentials({ usuario, email, senha }) // valida
  if (validation) return res.status(400).json({ error: validation }) // tratamento de erro.

  try {
    const hash = await bcrypt.hash(senha, 12) // criptografa a senha.
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)' // monta o query
    ).run(usuario.trim(), email.trim().toLowerCase(), hash, 'admin') // aqui, põe o cadastro e define como admin e manda pro db
    req.session.userId = Number(result.lastInsertRowid)
    const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(req.session.userId) // confere se postou
    res.status(201).json({ user: cleanUser(user) }) // retorna a sessão com created.
  } catch (error) {
    if (String(error.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Esse usuário ou e-mail já está cadastrado.' }) // mais uma vez, coonfere se não há repetição no db.
    }
    console.error(error)
    res.status(500).json({ error: 'Não foi possível criar a conta de administrador.' }) // Mais uma vez, não é pra chegar aqui.
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => { // Rota de autenticação de usuário. Simples.
  const identificador = typeof req.body?.identificador === 'string' ? req.body.identificador.trim() : ''
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : ''
  if (!identificador || !senha) return res.status(400).json({ error: 'Informe usuário/e-mail e senha.' })

  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE' // COLLATE em resumo evita diferenciação de maiúsculas e minúsculas.
  ).get(identificador, identificador)

  if (!user || !(await bcrypt.compare(senha, user.password_hash))) {
    return res.status(401).json({ error: 'Usuário/e-mail ou senha incorretos.' })
  }

  req.session.regenerate((err) => { // Cria um novo id de sessão pra evitar bug.
    if (err) return res.status(500).json({ error: 'Não foi possível iniciar a sessão.' })  // Não deveria chegar aqui.
    req.session.userId = user.id
    res.json({ user: cleanUser(user) })
  })
})

app.post('/api/auth/logout', (req, res) => { // logout.
  req.session.destroy((err) => { // quebra a sessão.
    if (err) return res.status(500).json({ error: 'Não foi possível encerrar a sessão.' }) // Não deveria chegar aqui.
    res.clearCookie('cinemaneiro.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction })
    res.json({ ok: true })
  })
})

app.get('/api/me/lists', requireAuth, (req, res) => { // retorna a lista do usuário.
  const rows = db.prepare(
    'SELECT movie_id, list_type FROM user_movies WHERE user_id = ?'
  ).all(req.session.userId)
  const favorites = rows.filter(row => row.list_type === 'favorite').map(row => row.movie_id)
  const watchLater = rows.filter(row => row.list_type === 'watch_later').map(row => row.movie_id)
  res.json({ favorites, watchLater })
})

app.put('/api/me/lists/:type/:movieId', requireAuth, (req, res) => { // Adiciona o filme em uma lista.
  const types = { favorite: 'favorite', watch_later: 'watch_later' }
  const listType = types[req.params.type]
  const movieId = req.params.movieId
  if (!listType || !/^tt\d{7,10}$/.test(movieId)) {
    return res.status(400).json({ error: 'Filme ou lista inválidos.' })
  }
  db.prepare(
    'INSERT OR IGNORE INTO user_movies (user_id, movie_id, list_type) VALUES (?, ?, ?)'
  ).run(req.session.userId, movieId, listType)
  res.json({ ok: true })
})

app.delete('/api/me/lists/:type/:movieId', requireAuth, (req, res) => { // Remove o filme de uma lista.
  const types = { favorite: 'favorite', watch_later: 'watch_later' }
  const listType = types[req.params.type]
  const movieId = req.params.movieId
  if (!listType || !/^tt\d{7,10}$/.test(movieId)) {
    return res.status(400).json({ error: 'Filme ou lista inválidos.' })
  }
  db.prepare(
    'DELETE FROM user_movies WHERE user_id = ? AND movie_id = ? AND list_type = ?'
  ).run(req.session.userId, movieId, listType)
  res.json({ ok: true })
})

/*
  Mais coisas do express, aqui em resumo, deixa o express estático para que ele possa servir o Vue.
*/
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distPath = path.join(root, 'dist')
app.use(express.static(distPath))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Aplicação não compilada. Execute npm run build.')
  })
})

app.listen(PORT, () => { // Startup do servidor.
  console.log(`API CineManeiro rodando em http://localhost:${PORT}`)
})