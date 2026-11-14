<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  filme: { type: Object, required: true },
  usuario: { type: Object, default: null }
})

const emit = defineEmits(['voltar', 'pedir-login'])

const detalhes = ref(null)
const avaliacoes = ref([])
const notaMedia = ref(null)
const quantidadeAvaliacoes = ref(0)
const minhaAvaliacao = ref(null)
const nota = ref(null)
const comentario = ref('')
const carregandoDetalhes = ref(true)
const carregandoAvaliacoes = ref(true)
const enviando = ref(false)
const erro = ref('')
const aviso = ref('')

const poster = computed(() => detalhes.value?.poster ||
  `https://images.metahub.space/poster/medium/${props.filme.id}/img`)
const imagens = computed(() => {
  const lista = [detalhes.value?.backdrop, ...(detalhes.value?.images || [])].filter(Boolean)
  return [...new Set(lista)].slice(0, 10)
})
const anoLancamento = computed(() => {
  const data = detalhes.value?.releaseDate || `${props.filme.ano || ''}`
  return String(data).slice(0, 4)
})

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

async function carregarDetalhes() {
  carregandoDetalhes.value = true
  erro.value = ''
  try {
    detalhes.value = await api(`/api/movies/${props.filme.id}/details`)
  } catch (error) {
    erro.value = error.message
    detalhes.value = null
  } finally {
    carregandoDetalhes.value = false
  }
}

async function carregarAvaliacoes() {
  carregandoAvaliacoes.value = true
  try {
    const data = await api(`/api/reviews/movie/${props.filme.id}`)
    avaliacoes.value = data.reviews || []
    notaMedia.value = data.average
    quantidadeAvaliacoes.value = data.count || 0
    minhaAvaliacao.value = data.myReview || null

    if (minhaAvaliacao.value) {
      nota.value = minhaAvaliacao.value.score
      comentario.value = minhaAvaliacao.value.comment
    } else {
      nota.value = null
      comentario.value = ''
    }
  } catch (error) {
    erro.value = error.message
  } finally {
    carregandoAvaliacoes.value = false
  }
}

async function salvarAvaliacao() {
  if (nota.value === null || nota.value === '') {
    erro.value = 'Escolha uma nota de 0 a 10 antes de publicar.'
    return
  }

  if (!props.usuario) {
    emit('pedir-login')
    return
  }

  erro.value = ''
  aviso.value = ''
  enviando.value = true
  try {
    await api(`/api/reviews/movie/${props.filme.id}`, {
      method: 'POST',
      body: JSON.stringify({ score: Number(nota.value), comment: comentario.value })
    })
    aviso.value = 'Sua avaliação foi publicada.'
    await carregarAvaliacoes()
  } catch (error) {
    erro.value = error.message
  } finally {
    enviando.value = false
  }
}

async function removerAvaliacao(reviewId) {
  if (!window.confirm('Tem certeza de que deseja remover esta avaliação?')) return
  erro.value = ''
  aviso.value = ''
  try {
    await api(`/api/reviews/${reviewId}`, { method: 'DELETE' })
    aviso.value = 'Avaliação removida.'
    await carregarAvaliacoes()
  } catch (error) {
    erro.value = error.message
  }
}

function formatarData(value) {
  if (!value) return ''
  const date = new Date(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR')
}

onMounted(() => {
  carregarDetalhes()
  carregarAvaliacoes()
})

// Trocar de filme sem voltar pro catálogo? Então bora atualizar tudo também.
watch(() => props.filme.id, () => {
  carregarDetalhes()
  carregarAvaliacoes()
})

watch(() => props.usuario?.id, () => carregarAvaliacoes())
</script>

<template>
  <section class="space-y-8">
    <div class="flex items-center justify-between gap-4">
      <button type="button" @click="emit('voltar')" class="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
        ← Voltar ao catálogo
      </button>
      <a :href="`https://www.imdb.com/title/${filme.id}/`" target="_blank" rel="noopener noreferrer" class="text-sm text-yellow-400 hover:underline">
        Ver no IMDb ↗
      </a>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div class="relative min-h-56 bg-slate-800 md:min-h-80">
        <img v-if="detalhes?.backdrop" :src="detalhes.backdrop" :alt="`Imagem de fundo de ${filme.titulo}`" class="absolute inset-0 h-full w-full object-cover opacity-35">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/10"></div>
        <div class="relative z-10 flex min-h-56 items-end gap-5 p-5 md:min-h-80 md:gap-8 md:p-8">
          <img :src="poster" :alt="`Pôster de ${filme.titulo}`" class="hidden w-36 rounded-xl border border-slate-600 object-cover shadow-2xl sm:block md:w-48" @error="$event.target.src = 'https://placehold.co/400x600/1e293b/ffffff?text=Poster+Indisponivel'">
          <div class="min-w-0 pb-1">
            <p class="mb-2 text-xs font-bold uppercase tracking-[.2em] text-yellow-400">Detalhes do filme</p>
            <h1 class="text-3xl font-black leading-tight text-white md:text-5xl">{{ filme.titulo }}</h1>
            <p class="mt-3 text-sm text-slate-300">
              <span v-if="anoLancamento">{{ anoLancamento }}</span>
              <span v-if="detalhes?.runtime"> • {{ detalhes.runtime }} min</span>
              <span v-else-if="filme.duracao"> • {{ filme.duracao }}</span>
            </p>
            <div v-if="detalhes?.genres?.length" class="mt-3 flex flex-wrap gap-2">
              <span v-for="genero in detalhes.genres" :key="genero" class="rounded-full border border-slate-500/70 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">{{ genero }}</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-3">
              <span class="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-black text-slate-950">IMDb ⭐ {{ filme.nota.toFixed(1) }}</span>
              <span class="rounded-lg border border-slate-500 bg-slate-900/80 px-3 py-2 text-sm font-bold text-white">
                Comunidade ⭐ {{ notaMedia === null ? '—' : notaMedia.toFixed(1) }} / 10
                <span class="font-normal text-slate-400">({{ quantidadeAvaliacoes }})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-8 p-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)] md:p-8">
        <div>
          <h2 class="mb-3 text-xl font-bold">Sinopse</h2>
          <p v-if="detalhes?.tagline" class="mb-3 italic text-slate-400">{{ detalhes.tagline }}</p>
          <p v-if="detalhes?.overview" class="leading-7 text-slate-300">{{ detalhes.overview }}</p>
          <p v-else-if="carregandoDetalhes" class="text-slate-400">Carregando informações do filme...</p>
          <p v-else class="text-slate-400">Sinopse indisponível no momento.</p>
          <p v-if="detalhes && !detalhes.configured" class="mt-4 rounded-lg border border-amber-800/70 bg-amber-950/30 p-3 text-sm text-amber-200">
            Para exibir a sinopse, a galeria e o trailer, configure <code>TMDB_ACCESS_TOKEN</code> no arquivo <code>.env</code> do servidor.
          </p>
          <p v-if="erro" class="mt-4 text-sm text-red-400">{{ erro }}</p>
        </div>

        <div>
          <h2 class="mb-3 text-xl font-bold">Trailer</h2>
          <div v-if="detalhes?.trailer" class="aspect-video overflow-hidden rounded-xl border border-slate-700 bg-black">
            <iframe
              :src="detalhes.trailer.embedUrl"
              :title="`Trailer de ${filme.titulo}`"
              class="h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
            ></iframe>
          </div>
          <p v-else-if="carregandoDetalhes" class="rounded-xl bg-slate-800 p-5 text-sm text-slate-400">Procurando trailer...</p>
          <p v-else class="rounded-xl bg-slate-800 p-5 text-sm text-slate-400">Trailer não encontrado no TMDB para este filme.</p>
          <a v-if="detalhes?.trailer?.watchUrl" :href="detalhes.trailer.watchUrl" target="_blank" rel="noopener noreferrer" class="mt-2 inline-block text-sm text-yellow-400 hover:underline">Abrir trailer no YouTube ↗</a>
        </div>
      </div>
    </div>

    <section v-if="imagens.length" class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl font-bold">Imagens do filme</h2>
        <span class="text-xs text-slate-500">{{ imagens.length }} imagens</span>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <a v-for="(imagem, index) in imagens" :key="imagem" :href="imagem" target="_blank" rel="noopener noreferrer" class="group overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <img :src="imagem" :alt="`Imagem ${index + 1} de ${filme.titulo}`" loading="lazy" class="aspect-video h-full w-full object-cover transition duration-300 group-hover:scale-105">
        </a>
      </div>
    </section>

    <section class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-2xl font-black">Avaliações da comunidade</h2>
          <p class="mt-1 text-sm text-slate-400">Dê uma nota de 0 a 10 e conte o que achou do filme.</p>
        </div>
        <span class="text-sm text-slate-400">{{ quantidadeAvaliacoes }} avaliação(ões)</span>
      </div>

      <form class="rounded-xl border border-slate-700 bg-slate-900 p-5" @submit.prevent="salvarAvaliacao">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label for="nota-filme" class="font-bold">Sua nota</label>
          <select id="nota-filme" v-model.number="nota" required class="rounded-lg border border-slate-600 bg-[#172b3a] px-3 py-2 text-lg font-bold text-yellow-400 outline-none focus:border-yellow-400">
            <option :value="null" disabled>Selecione uma nota</option>
            <option v-for="valor in 11" :key="valor - 1" :value="valor - 1">{{ valor - 1 }} / 10</option>
          </select>
        </div>
        <label for="comentario-filme" class="mb-2 block font-bold">Comentário</label>
        <textarea id="comentario-filme" v-model="comentario" required maxlength="1000" rows="4" placeholder="Escreva sua opinião sobre o filme..." class="w-full rounded-lg border border-slate-600 bg-[#172b3a] p-3 text-white outline-none placeholder:text-slate-500 focus:border-yellow-400"></textarea>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-slate-500">{{ comentario.length }}/1000 caracteres</p>
          <button type="submit" :disabled="enviando || carregandoAvaliacoes || nota === null" class="rounded-lg bg-yellow-400 px-5 py-2.5 font-bold text-slate-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60">
            {{ enviando ? 'Publicando...' : minhaAvaliacao ? 'Atualizar avaliação' : 'Publicar avaliação' }}
          </button>
        </div>
        <p v-if="!usuario" class="mt-3 text-sm text-slate-400">Você precisa <button type="button" @click="emit('pedir-login')" class="font-semibold text-yellow-400 hover:underline">entrar na sua conta</button> para publicar uma avaliação.</p>
        <p v-if="aviso" class="mt-3 text-sm text-emerald-400">{{ aviso }}</p>
        <p v-if="erro" class="mt-3 text-sm text-red-400">{{ erro }}</p>
      </form>

      <div v-if="carregandoAvaliacoes" class="py-6 text-center text-slate-400">Carregando avaliações...</div>
      <div v-else-if="avaliacoes.length" class="space-y-3">
        <article v-for="avaliacao in avaliacoes" :key="avaliacao.id" class="rounded-xl border border-slate-700 bg-slate-900 p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-bold text-white">{{ avaliacao.username }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ formatarData(avaliacao.createdAt) }}</p>
            </div>
            <span class="rounded-lg bg-yellow-400/15 px-3 py-1.5 font-black text-yellow-300">⭐ {{ avaliacao.score }} / 10</span>
          </div>
          <p class="mt-4 whitespace-pre-wrap break-words leading-7 text-slate-300">{{ avaliacao.comment }}</p>
          <div v-if="usuario?.role === 'admin'" class="mt-4 border-t border-slate-800 pt-3 text-right">
            <button @click="removerAvaliacao(avaliacao.id)" class="text-sm font-semibold text-red-400 hover:text-red-300">Remover comentário</button>
          </div>
        </article>
      </div>
      <p v-else class="rounded-xl border border-dashed border-slate-700 py-8 text-center text-slate-400">Ainda não existem avaliações para este filme. Seja o primeiro!</p>
    </section>

    <p class="border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
      Dados e imagens fornecidos pelo TMDB. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
      <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" class="text-slate-300 underline">The Movie Database (TMDB)</a>.
    </p>
  </section>
</template>
