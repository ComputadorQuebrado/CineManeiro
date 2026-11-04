<script setup>
import { computed, onMounted, ref } from 'vue'
import { filmes } from './data/filmes'

// Vue usa javascript como bnase pro app, dentro dele, tem muita coisa em HTML também, já que é o que monta a página.

// Variáveis que o site vai usar

const usuario = ref(null)
const listas = ref({ favorites: [], watchLater: [] })
const pesquisa = ref('')
const ordem = ref('1')
const aba = ref('catalogo')
const modal = ref('')
const mensagem = ref('')
const erro = ref('')
const carregando = ref(false)
const form = ref({ usuario: '', email: '', senha: '', identificador: '' })

/* WIP, admin ainda não possui uma função definida. */

const adminToken = window.location.pathname.startsWith('/cadastro-admin/')
  ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) || '')
  : ''
const paginaAdmin = Boolean(adminToken)

/*
  Função api:

  Serve como centralização das requisições, gpt me recomendou fazer isso pra evitar estresse.

*/

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Ocorreu um erro.')
  return data
}


/*
  Função que confere o cookie do navegador pra conferir se já existe sessão, se sim, segue com a sessão.

*/

async function carregarSessao() {
  try {
    const data = await api('/api/auth/me')
    usuario.value = data.user
    if (usuario.value) await carregarListas()
  } catch {
    usuario.value = null
  }
}

// Viva o hoisting.

async function carregarListas() { // Auto descritivo, carrega as listas do usuário.
  if (!usuario.value) return // verifica sessão.
  try {
    listas.value = await api('/api/me/lists')
  } catch (e) {
    erro.value = e.message
  }
}

async function enviarCadastro(admin = false) { // por padrão define admin como falso para evitar solicitações maliciosas.
  erro.value = ''
  mensagem.value = ''
  carregando.value = true
  try {
    const payload = { // montando o objeto
      usuario: form.value.usuario,
      email: form.value.email,
      senha: form.value.senha
    }
    const endpoint = admin ? '/api/auth/register-admin' : '/api/auth/register' // se o link de cadastro for o link de admin: http://localhost:5173/cadastro-admin/abcdefghijklmnopqrstuvwxyz (bem criativa a chave)
    const data = await api(endpoint, {                                         // cadastra um admin pela rota de admin (meio inseguro né).
      method: 'POST',
      body: JSON.stringify(admin ? { ...payload, inviteToken: adminToken } : payload)
    })
    usuario.value = data.user
    listas.value = { favorites: [], watchLater: [] }
    modal.value = ''
    mensagem.value = admin ? 'Conta de administrador criada!' : 'Conta criada com sucesso!'
    form.value = { usuario: '', email: '', senha: '', identificador: '' }
    if (admin) history.replaceState({}, '', '/')
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

/*
  Sisteminha de login bem simples, o corpo vai ser um usuario, email e senha.
  Como funciona? É um form que coleta os dados, compara no banco de dados, e se existir, salva a sessão do usuário na página.
*/
async function entrar() {
  erro.value = ''
  carregando.value = true
  try {
    const data = await api('/api/auth/login', { // a função api retorna o bloco de dados contendo o user.
      method: 'POST',
      body: JSON.stringify({
        identificador: form.value.identificador,
        senha: form.value.senha
      })
    })
    usuario.value = data.user
    await carregarListas()
    modal.value = ''
    mensagem.value = `Bem-vindo, ${usuario.value.usuario}!`
    form.value = { usuario: '', email: '', senha: '', identificador: '' }
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

async function sair() { // função de logout.
  try {
    await api('/api/auth/logout', { method: 'POST' })
    usuario.value = null
    listas.value = { favorites: [], watchLater: [] }
    aba.value = 'catalogo'
    mensagem.value = 'Deslogado com sucesso!.'
  } catch (e) {
    erro.value = e.message
  }
}

function possui(tipo, id) { // confere se está na lista.
  return listas.value[tipo].includes(id)
}


/*
  Essa aqui foi trabalhosa de fazer

  Em resumo, confere se o usuário está logado, se estiver, salva o filme na lista X recebida
  Se não estiver logado, abre a tela de login pedindo pra fazer login para poder salvar, sofisticado no mínimo.

*/
async function alternarLista(tipo, id) {
  if (!usuario.value) {
    modal.value = 'login'
    erro.value = 'Entre na sua conta para salvar filmes.'
    return
  }
  const chave = tipo === 'favorites' ? 'favorite' : 'watch_later'
  const endpoint = `/api/me/lists/${chave}/${id}`
  try {
    if (possui(tipo, id)) {
      await api(endpoint, { method: 'DELETE' })
      listas.value[tipo] = listas.value[tipo].filter(item => item !== id)
    } else {
      await api(endpoint, { method: 'PUT' })
      listas.value[tipo] = [...listas.value[tipo], id]
    }
  } catch (e) {
    erro.value = e.message
  }
}

const filmesExibidos = computed(() => {
  let resultado = filmes.filter(filme =>
    filme.titulo.toLocaleLowerCase('pt-BR').includes(pesquisa.value.toLocaleLowerCase('pt-BR').trim())
    /*
      Essa linha contém o mecanismo de pesquisa, como funciona? Ela filtra dentro da lista de filmes por títulos que contém o conteúdo da barra de pesquisa
      Garanti que tanto o título do filme quanto o conteúdo da barra de pesquisa estejam em minúsculo pra evitar problemas
      Obs. tive que adicionar um .trim() pra evitar que espaços atrapalhem na busca. Obrigado Rust por me ensinar essa!
     */

  )

  if (aba.value === 'favoritos') {
    resultado = resultado.filter(filme => possui('favorites', filme.id))
  } else if (aba.value === 'assistir') {
    resultado = resultado.filter(filme => possui('watchLater', filme.id))
  }

  // Sisteminha que muda a ordem exibida dos filmes!

  switch (ordem.value) {
    case '2':
      resultado.sort((a, b) => b.nota - a.nota || (b.votos || 0) - (a.votos || 0))
      break
    case '3':
      resultado.sort((a, b) => (b.votos || 0) - (a.votos || 0))
      break
    case '4':
      resultado.sort((a, b) => b.ano - a.ano)
      break
    case '5':
      resultado.sort((a, b) => a.ano - b.ano)
      break
    case '6':
      resultado.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
      break
  }
  return resultado
})

onMounted(carregarSessao) // Carrega a sessão quando a tela é montada.

/*
  E tome HTML
*/
</script>

<template>
  <main class="min-h-screen bg-[#0f202e] text-slate-100">
    <div v-if="paginaAdmin" class="mx-auto flex min-h-screen max-w-md items-center px-5 py-12">
      <form class="w-full rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl" @submit.prevent="enviarCadastro(true)">
        <p class="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-400">Área restrita</p>
        <h1 class="mb-2 text-2xl font-bold">Cadastro de administrador</h1>
        <p class="mb-6 text-sm text-slate-400">Este convite permite criar uma conta com privilégios administrativos.</p>
        <div class="space-y-4">
          <input v-model="form.usuario" required minlength="3" maxlength="30" autocomplete="username" placeholder="Usuário" class="field">
          <input v-model="form.email" required type="email" autocomplete="email" placeholder="E-mail" class="field">
          <input v-model="form.senha" required type="password" minlength="8" maxlength="72" autocomplete="new-password" placeholder="Senha (mínimo 8 caracteres)" class="field">
        </div>
        <p v-if="erro" class="mt-4 text-sm text-red-400">{{ erro }}</p>
        <button :disabled="carregando" class="mt-6 w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-slate-950 hover:bg-yellow-300">
          {{ carregando ? 'Criando...' : 'Criar administrador' }}
        </button>
      </form>
    </div>

    <template v-else>
      <header class="border-b border-slate-700/70 bg-[#102333]">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <a href="/" class="text-3xl font-semibold tracking-tight text-white">Cine<span class="text-yellow-400">Maneiro</span></a>
          <div class="flex items-center gap-2">
            <template v-if="usuario">
              <span class="hidden text-sm text-slate-300 sm:inline">Olá, {{ usuario.usuario }}</span>
              <span v-if="usuario.role === 'admin'" class="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-300">ADMIN</span>
              <button @click="sair" class="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Sair</button>
            </template>
            <template v-else>
              <button @click="modal = 'login'; erro = ''" class="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">Entrar</button>
              <button @click="modal = 'cadastro'; erro = ''" class="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-semibold hover:bg-yellow-400">Criar conta</button>
            </template>
          </div>
        </div>
      </header>

      <div class="mx-auto max-w-7xl px-5 py-8">
        <div v-if="mensagem" class="mb-5 rounded-lg border border-emerald-700 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-300">
          {{ mensagem }} <button class="float-right" @click="mensagem = ''">✕</button>
        </div>
        <div v-if="erro && !modal" class="mb-5 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">
          {{ erro }} <button class="float-right" @click="erro = ''">✕</button>
        </div>

        <section class="mb-7 grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div class="md:col-span-9">
            <label for="pesquisa" class="mb-2 block font-bold">Catálogo de Filmes</label>
            <input id="pesquisa" v-model="pesquisa" type="search" placeholder="Pesquisar por título..." class="field">
          </div>
          <div class="md:col-span-3">
            <label for="ordem" class="mb-2 block font-bold">Ordem</label>
            <select id="ordem" v-model="ordem" class="field">
              <option value="1">Melhor avaliação</option>
              <option value="3">Mais votados</option>
              <option value="4">Mais Recentes</option>
              <option value="5">Mais Antigos</option>
              <option value="6">Título (A - Z)</option>
            </select>
          </div>
        </section>

        <nav class="mb-7 flex flex-wrap gap-2" aria-label="Listas de filmes"> <!-- Botõezinhos de seleção de lista -->
            <button
                @click="aba = 'catalogo'"
                :class="aba === 'catalogo'
                    ? 'bg-yellow-400 text-gray-900 border-yellow-400'
                    : 'bg-transparent text-gray-300 border-gray-600'"
                class="rounded-xl border px-4 py-3 font-semibold transition-all"
            >
                Todos os filmes
            </button>

            <button
                @click="aba = 'favoritos'"
                :class="aba === 'favoritos'
                    ? 'bg-yellow-400 text-gray-900 border-yellow-400'
                    : 'bg-transparent text-gray-300 border-gray-600'"
                class="rounded-xl border px-4 py-3 font-semibold transition-all"
            >
                ♥ Favoritos
            </button>

            <button
                @click="aba = 'assistir'"
                :class="aba === 'assistir'
                    ? 'bg-yellow-400 text-gray-900 border-yellow-400'
                    : 'bg-transparent text-gray-300 border-gray-600'"
                class="rounded-xl border px-4 py-3 font-semibold transition-all"
            >
                ＋ Assistir mais tarde
            </button>
        </nav>

        <section v-if="filmesExibidos.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <!-- Aqui é onde cada filme é montado no site, é um for bem simples, que vai adicionando um por um no site 
              Notei que talvez seja uma boa ideia limitar o número de filmes por página já que o site está comendo 514mb de ram nesse momento. 

              Os filmes vão ser separados com as seguintes informações, conforme coletadas do IMDB:

              capa do filme
              título do filme
              ano de lançamento
              duração do filme
              nota do filme
              número de votos no IMDB
              Os botões de favoritar e assistir mais tarde
              E um botão de detalhes que leva o usuário para a página do IMDB, considero fazer uma página com os detalhes dentro do site também.
          -->
          <article v-for="(filme, index) in filmesExibidos" :key="filme.id" class="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900 shadow-lg transition hover:-translate-y-1 hover:border-slate-500">
            <div class="relative">
              <img
                :src="`https://images.metahub.space/poster/medium/${filme.id}/img`"
                :alt="`Pôster de ${filme.titulo}`"
                loading="lazy"
                class="h-64 w-full bg-slate-800 object-cover sm:h-72"
                @error="$event.target.src = 'https://placehold.co/400x600/1e293b/ffffff?text=Poster+Indisponivel'"
              >
              <span class="absolute left-2 top-2 rounded bg-yellow-600 px-2 py-1 text-xs font-bold">#{{ filmes.findIndex(item => item.id === filme.id) + 1 }}</span>
            </div>
            <div class="flex min-h-44 flex-col p-3">
              <h2 class="truncate font-bold" :title="filme.titulo">{{ filme.titulo }}</h2>
              <p class="mt-1 text-sm text-slate-400">{{ filme.ano }} • {{ filme.duracao }}</p>
              <span class="mt-2 w-fit rounded bg-yellow-400 px-2 py-1 text-sm font-bold text-slate-950">⭐ {{ filme.nota.toFixed(1) }}</span>
              <p v-if="filme.votos" class="mt-1 text-xs text-slate-500">{{ filme.votos.toLocaleString('pt-BR') }} votos no IMDb</p>
              <div class="mt-auto grid grid-cols-2 gap-2 pt-4">
                <button @click="alternarLista('favorites', filme.id)" :aria-pressed="possui('favorites', filme.id)" :class="possui('favorites', filme.id) ? 'action-active' : 'action'">
                  {{ possui('favorites', filme.id) ? '♥ Favorito' : '♡ Favoritar' }}
                </button>
                <button @click="alternarLista('watchLater', filme.id)" :aria-pressed="possui('watchLater', filme.id)" :class="possui('watchLater', filme.id) ? 'action-active' : 'action'">
                  {{ possui('watchLater', filme.id) ? '✓ Na lista' : '+ Assistir' }}
                </button>
              </div>
              <a :href="`https://www.imdb.com/title/${filme.id}/`" target="_blank" rel="noopener noreferrer" class="mt-2 rounded-lg bg-yellow-600 px-3 py-2 text-center text-sm font-semibold hover:bg-yellow-400">Detalhes</a>
            </div>
          </article>
        </section>
        <p v-else class="py-16 text-center text-slate-400">
          {{ aba === 'favoritos' ? 'Você ainda não favoritou nenhum filme.' : aba === 'assistir' ? 'Sua lista de filmes para assistir está vazia.' : 'Nenhum filme encontrado.' }}
        </p>
      </div>

      <div v-if="modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="modal = ''; erro = ''">
        <section class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-2xl font-bold">{{ modal === 'login' ? 'Entrar' : 'Criar conta' }}</h2>
            <button @click="modal = ''; erro = ''" aria-label="Fechar" class="text-2xl text-slate-400 hover:text-white">×</button>
          </div>
          <form v-if="modal === 'cadastro'" class="space-y-4" @submit.prevent="enviarCadastro(false)">
            <input v-model="form.usuario" required minlength="3" maxlength="30" autocomplete="username" placeholder="Usuário" class="field">
            <input v-model="form.email" required type="email" autocomplete="email" placeholder="E-mail" class="field">
            <input v-model="form.senha" required type="password" minlength="8" maxlength="72" autocomplete="new-password" placeholder="Senha (mínimo 8 caracteres)" class="field">
            <p class="text-xs text-slate-400">A senha precisa ter pelo menos 8 caracteres.</p>
            <p v-if="erro" class="text-sm text-red-400">{{ erro }}</p>
            <button :disabled="carregando" class="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500">{{ carregando ? 'Criando...' : 'Cadastrar' }}</button>
          </form>
          <form v-else class="space-y-4" @submit.prevent="entrar">
            <input v-model="form.identificador" required autocomplete="username" placeholder="Usuário ou e-mail" class="field">
            <input v-model="form.senha" required type="password" autocomplete="current-password" placeholder="Senha" class="field">
            <p v-if="erro" class="text-sm text-red-400">{{ erro }}</p>
            <button :disabled="carregando" class="w-full rounded-lg bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500">{{ carregando ? 'Entrando...' : 'Entrar' }}</button>
          </form>
          <p class="mt-5 text-center text-sm text-slate-400">
            <template v-if="modal === 'login'">Não tem conta? <button @click="modal = 'cadastro'; erro = ''" class="font-semibold text-yellow-400 hover:underline">Cadastre-se</button></template>
            <template v-else>Já tem conta? <button @click="modal = 'login'; erro = ''" class="font-semibold text-yellow-400 hover:underline">Entrar</button></template>
          </p>
        </section>
      </div>
      <footer class="border-t border-slate-700/70 px-5 py-6 text-center text-xs text-slate-500">
        Você está acessando o CineManeiro!
      </footer>
    </template>
  </main>
</template>

<style scoped>
.field {
  width: 100%;
  border: 1px solid #475569;
  border-radius: .6rem;
  background: #f8fafc;
  padding: .8rem .9rem;
  color: #0f172a;
  outline: none;
}
.field:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgb(59 130 246 / .2); }
.tab, .tab-active {
  border-radius: .6rem;
  padding: .65rem 1rem;
  font-size: .9rem;
  font-weight: 600;
  transition: .15s;
}
.tab { border: 1px solid #475569; color: #cbd5e1; }
.tab:hover { background: #1e293b; }
.tab-active { background: #2563eb; color: white; }
.action, .action-active {
  border-radius: .5rem;
  padding: .55rem .35rem;
  font-size: .75rem;
  font-weight: 700;
}
.action { border: 1px solid #475569; color: #cbd5e1; }
.action:hover { background: #1e293b; }
.action-active { background: #713f12; color: #fde68a; border: 1px solid #a16207; }
</style>