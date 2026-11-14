import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { createSessionStore } from './config/sessionStore.js'
import { createAuthRoutes } from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import movieRoutes from './routes/movieRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'

const app = express() // Não entendi muito bem como o express() funciona, mas precisa dele. Só sei que precisa dele pra fazer as rotas.
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

app.use(helmet({  // Mais uma ajuda do Gpt, Perguntei se tinha alguma maneira boa pra carregar coisas de sites alheios, e ele me recomendou usar o helmet como Middleware.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'https://images.metahub.space', 'https://image.tmdb.org', 'https://placehold.co', 'data:'],
      frameSrc: ['https://www.youtube-nocookie.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}))

// Em resumo, o helmet evita que coisas de sites não colocados na whitelist acessem o site. Eu pessoalmente achei bem legal então vou usar, por mais que nesse caso seja inútil.

app.use(express.json({ limit: '20kb' })) // Limitar as requisições em 20kb e permitir que o express use JSON.

// Limpando as sessões vencidas, porque ninguém merece acumular tranqueira no banco.
db.prepare('DELETE FROM sessions WHERE expired IS NOT NULL AND expired < ?').run(Date.now()) // E mais uma vez, Gpt recomendou limpar as sessões expiradas do banco de dados.

// Mais um middleware, dessa vez, serve pra manter o usuário autenticado durante as requisições.
app.use(session({
  name: 'cinemaneiro.sid',
  store: createSessionStore(),
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
})

// Outra dica do Gpt, limitar tentativas para evitar DDOS
app.get('/api/health', (_req, res) => res.json({ ok: true })) // teste de vida do servidor, se retornar ok é pq tá rodando.
app.use('/api/auth', createAuthRoutes(authLimiter))
app.use('/api/me', userRoutes)
app.use('/api/movies', movieRoutes)
app.use('/api/reviews', reviewRoutes)

/*
  Mais coisas do express, aqui em resumo, deixa o express estático para que ele possa servir o Vue.
*/
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distPath = path.join(root, 'dist')
app.use(express.static(distPath))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distPath, 'index.html'), error => {
    if (error) res.status(404).send('Aplicação não compilada. Execute npm run build.')
  })
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Ocorreu um erro inesperado no servidor.' })
})

app.listen(PORT, () => { // Startup do servidor.
  console.log(`API CineManeiro rodando em http://localhost:${PORT}`)
})
