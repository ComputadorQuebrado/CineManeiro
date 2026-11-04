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

function persist() { // para salvar os dados que foram alterados, pra evitar dessincronização.
  const bytes = raw.export()
  fs.writeFileSync(databasePath, Buffer.from(bytes))
}

function valuesOf(statement) {
  const result = []
  while (statement.step()) result.push(statement.getAsObject())
  statement.free()
  return result
}

export const db = {
  exec(sql) {
    raw.run(sql)
    persist()
  },
  pragma(_value) {
  },
  prepare(sql) {
    return {
      get(...params) {
        const stmt = raw.prepare(sql)
        try {
          stmt.bind(params)
          return stmt.step() ? stmt.getAsObject() : undefined
        } finally { stmt.free() }
      },
      all(...params) {
        const stmt = raw.prepare(sql)
        try {
          stmt.bind(params)
          return valuesOf(stmt)
        } finally { }
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

// criando o banco de dados caso ele seja apagado ou não tenha sido criado.

raw.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    movie_id TEXT NOT NULL,
    list_type TEXT NOT NULL CHECK(list_type IN ('favorite', 'watch_later')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id, list_type),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_user_movies_user_type
  ON user_movies(user_id, list_type);
`)
persist()
