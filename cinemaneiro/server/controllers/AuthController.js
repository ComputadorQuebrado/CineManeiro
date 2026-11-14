import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { User, publicUser } from '../models/User.js'

function validarDados({ usuario, email, senha }) { // Validador de solicitação de login.
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

function tokenBate(candidate, expected) { // Aqui confere se o token de admin bate.
  if (typeof candidate !== 'string' || typeof expected !== 'string') return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function criarConta(req, res, role) {
  const { usuario, email, senha } = req.body ?? {}
  const erro = validarDados({ usuario, email, senha })
  if (erro) return res.status(400).json({ error: erro })

  try {
    const passwordHash = await bcrypt.hash(senha, 12) // Criptografa a senha, jamais salvar ela pura né.
    const result = User.create({
      username: usuario.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role
    })
    req.session.userId = Number(result.lastInsertRowid)
    return res.status(201).json({ user: publicUser(User.findById(req.session.userId)) })
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Esse usuário ou e-mail já está cadastrado.' })
    }
    console.error(error)
    return res.status(500).json({ error: role === 'admin' ? 'Não foi possível criar a conta de administrador.' : 'Não foi possível criar a conta.' })
  }
}

export const AuthController = {
  me(req, res) { // verifica se o usuario está logado
    if (!req.session.userId) return res.json({ user: null })
    const user = User.findById(req.session.userId) // se tiver id de sessão, monta o user a partir dele.
    if (!user) { // senão
      req.session.destroy(() => {}) // destrói a sessão.
      return res.json({ user: null }) // retorna nulo.
    }
    res.json({ user: publicUser(user) }) // limpa o user usando a função clean e manda ele de volta como json.
  },

  register(req, res) { // registrando o usuário.
    return criarConta(req, res, 'user')
  },

  registerAdmin(req, res) {
    // Este link serve para o primeiro administrador; impede novos admins
    // mesmo que alguém reutilize o link depois do cadastro inicial.
    if (User.hasAdmin()) return res.status(404).json({ error: 'Convite administrativo indisponível.' }) // se tem admin cadastrado já, bloqueia o convite.
    if (!tokenBate(req.body?.inviteToken, process.env.ADMIN_INVITE_TOKEN)) {
      return res.status(404).json({ error: 'Página não encontrada ou convite inválido.' }) // caso o convite seja inválido.
    }
    return criarConta(req, res, 'admin')
  },

  async login(req, res) { // Rota de autenticação de usuário. Simples.
    const identificador = typeof req.body?.identificador === 'string' ? req.body.identificador.trim() : ''
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : ''
    if (!identificador || !senha) return res.status(400).json({ error: 'Informe usuário/e-mail e senha.' })

    const user = User.findForLogin(identificador) // COLLATE em resumo evita diferenciação de maiúsculas e minúsculas.
    if (!user || !(await bcrypt.compare(senha, user.password_hash))) {
      return res.status(401).json({ error: 'Usuário/e-mail ou senha incorretos.' })
    }

    req.session.regenerate(error => {
      if (error) return res.status(500).json({ error: 'Não foi possível iniciar a sessão.' })
      req.session.userId = user.id
      res.json({ user: publicUser(user) })
    })
  },

  logout(req, res) { // logout.
    req.session.destroy(error => { // quebra a sessão.
      if (error) return res.status(500).json({ error: 'Não foi possível encerrar a sessão.' })
      res.clearCookie('cinemaneiro.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
      res.json({ ok: true })
    })
  }
}
