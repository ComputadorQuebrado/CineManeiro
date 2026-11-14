import initSqlJs from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Mais um copypaste da internet, realmente não manjo nada.
  Chatgpt me deu uma ajuda aqui também, confesso ter estado meio perdido,
*/

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(here, '../data')
fs.mkdirSync(dataDir, { recursive: true })
const databasePath = path.join(dataDir, 'cinemaneiro.sqlite')

const SQL = await initSqlJs()
const raw = fs.existsSync(databasePath)
  ? new SQL.Database(new Uint8Array(fs.readFileSync(databasePath)))
  : new SQL.Database()

raw.run('PRAGMA foreign_keys = ON') // Só pra garantir que as referências entre as tabelas sejam respeitadas.

function persist() { // para salvar os dados que foram alterados, pra evitar dessincronização.
  const bytes = raw.export()
  fs.writeFileSync(databasePath, Buffer.from(bytes))
}

function rowsOf(statement) {
  const result = []
  while (statement.step()) result.push(statement.getAsObject())
  return result
}

export const db = {
  exec(sql) {
    raw.exec(sql)
    persist()
  },
  prepare(sql) {
    return {
      get(...params) {
        const stmt = raw.prepare(sql)
        try {
          stmt.bind(params)
          return stmt.step() ? stmt.getAsObject() : undefined
        } finally {
          stmt.free()
        }
      },
      all(...params) {
        const stmt = raw.prepare(sql)
        try {
          stmt.bind(params)
          return rowsOf(stmt)
        } finally {
          stmt.free()
        }
      },
      run(...params) {
        raw.run(sql, params)
        const changes = raw.getRowsModified()
        const row = raw.exec('SELECT last_insert_rowid() AS id')
        const lastInsertRowid = row[0]?.values[0]?.[0] ?? 0
        persist()
        return { changes, lastInsertRowid }
      }
    }
  },
  get raw() { return raw },
  persist
}

raw.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    year INTEGER,
    duration TEXT,
    rating REAL NOT NULL DEFAULT 0,
    votes INTEGER NOT NULL DEFAULT 0,
    genres TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_movies_position ON movies(position);
  CREATE TABLE IF NOT EXISTS user_movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    movie_id TEXT NOT NULL,
    list_type TEXT NOT NULL CHECK(list_type IN ('favorite', 'watch_later')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id, list_type),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_user_movies_user_type ON user_movies(user_id, list_type);
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    movie_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 10),
    comment TEXT NOT NULL CHECK(length(comment) BETWEEN 1 AND 1000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(movie_id) REFERENCES movies(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_movie_created ON reviews(movie_id, created_at DESC);
  -- Criando a tabela de sessões no db caso tenha sido apagada ou ainda não tenha sido criada.
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expired INTEGER
  );
`)

// criando o banco de dados caso ele tenha sido apagado ou ainda não tenha sido criado.
// Se estiver vazio, já aproveita e coloca os filmes iniciais dentro dele também.
const quantidadeFilmes = raw.exec('SELECT COUNT(*) FROM movies')[0].values[0][0]
if (quantidadeFilmes === 0) { // Aqui é a carga inicial, depois disso o banco manda em tudo.
  const arquivoInicial = path.join(here, 'seeds', 'filmes.sql')
  const cargaInicial = fs.readFileSync(arquivoInicial, 'utf8')
  raw.run('BEGIN TRANSACTION')
  try {
    raw.exec(cargaInicial)
    raw.run('COMMIT')
  } catch (error) {
    raw.run('ROLLBACK')
    throw error
  }
}

persist()
