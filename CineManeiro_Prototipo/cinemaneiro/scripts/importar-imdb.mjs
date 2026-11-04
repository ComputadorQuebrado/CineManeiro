import { createWriteStream, createReadStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/*
  Bom, a ideia aqui é simples, fazer um script que baixa, os dados do imdb e monta o catálogo dos filmes.
  pra fazer ele rodar, tem que mandar npm run importar:imdb no terminal.

  Peguei as funções aqui da internet, já que sou um grande de um zero à esquerda em JS.

*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data-imdb')
const basicsFile = path.join(dataDir, 'title.basics.tsv.gz')
const ratingsFile = path.join(dataDir, 'title.ratings.tsv.gz')
const outputFile = path.join(root, 'src', 'data', 'filmes.js')
const MIN_VOTES = 25_000
const LIMIT = 1_000

async function baixar(url, destino) {
  try { // colocar em try catch pra evitar explodir.
    const info = await stat(destino)
    if (info.size > 0) {
      console.log(`Arquivo já baixado: ${path.basename(destino)}`)
      return
    }
  } catch {}

  console.log(`Baixando ${path.basename(destino)}...`)
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destino))
  console.log(`Download concluído: ${path.basename(destino)}`)
}

async function* linhasTsv(arquivo) {
  const stream = createReadStream(arquivo).pipe(createGunzip())
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  let primeira = true
  for await (const linha of rl) {
    if (primeira) { primeira = false; continue }
    yield linha.split('\t')
  }
}

function duracao(minutos) {
  const n = Number(minutos)
  if (!Number.isFinite(n) || n <= 0) return 'Duração não informada'
  const horas = Math.floor(n / 60)
  const resto = n % 60
  return horas ? `${horas}h ${resto}m` : `${resto}m`
}

await mkdir(dataDir, { recursive: true })
await baixar('https://datasets.imdbws.com/title.ratings.tsv.gz', ratingsFile)
await baixar('https://datasets.imdbws.com/title.basics.tsv.gz', basicsFile)

console.log('Lendo avaliações do IMDb...')
const ratings = new Map()
for await (const cols of linhasTsv(ratingsFile)) {
  const [id, notaTexto, votosTexto] = cols
  const votos = Number(votosTexto)
  const nota = Number(notaTexto)
  if (id && Number.isFinite(nota) && votos >= MIN_VOTES) {
    ratings.set(id, { nota, votos })
  }
}
console.log(`${ratings.size.toLocaleString('pt-BR')} títulos com pelo menos ${MIN_VOTES.toLocaleString('pt-BR')} votos.`)

console.log('Relacionando avaliações com filmes...')
const filmes = []
for await (const cols of linhasTsv(basicsFile)) {
  const [id, tipo, titulo, , adulto, anoTexto, , minutos, generosTexto] = cols
  const avaliacao = ratings.get(id)
  if (!avaliacao || tipo !== 'movie' || adulto !== '0' || titulo === '\\N') continue
  const ano = Number(anoTexto)
  filmes.push({
    id,
    titulo,
    ano: Number.isFinite(ano) ? ano : null,
    duracao: duracao(minutos),
    nota: avaliacao.nota,
    votos: avaliacao.votos,
    generos: generosTexto && generosTexto !== '\\N' ? generosTexto.split(',') : []
  })
}

filmes.sort((a, b) => b.nota - a.nota || b.votos - a.votos || a.titulo.localeCompare(b.titulo))
const top = filmes.slice(0, LIMIT)
if (top.length < LIMIT) throw new Error(`Foram encontrados apenas ${top.length} filmes; esperado: ${LIMIT}.`)

const conteudo = `// Gerado em ${new Date().toISOString().slice(0, 10)} a partir dos datasets oficiais do IMDb.\n// Uso pessoal e não comercial. Consulte os termos do IMDb antes de publicar ou redistribuir.\nexport const filmes = ${JSON.stringify(top, null, 2)}\n`
await writeFile(outputFile, conteudo, 'utf8')
console.log(`\nConcluído! ${top.length} filmes importados para src/data/filmes.js.`)
console.log(`Primeiro colocado: ${top[0].titulo} (${top[0].ano}) — ${top[0].nota} (${top[0].votos.toLocaleString('pt-BR')} votos)`)
console.log('Reinicie o projeto com: npm run dev')
