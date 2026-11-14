# CineManeiro

Catálogo feito com Vue 3, Tailwind, Express e SQLite. Agora os filmes também ficam no banco, junto com as contas, listas e avaliações. A lista antiga virou só uma carga inicial do servidor: depois de importar, a tela consulta o SQLite e não aquele arquivo.

## Pra rodar

1. Instale o Node.js 22 ou mais recente.
2. Copie `.env.example` para `.env` e coloque seus próprios valores em `SESSION_SECRET` e `ADMIN_INVITE_TOKEN`.
3. Pra carregar sinopse, galeria e trailer, coloque o API Read Access Token do TMDB em `TMDB_ACCESS_TOKEN`. Sem ele, o catálogo e as avaliações continuam funcionando normalmente.
4. No terminal, dentro da pasta do projeto:

```bash
npm install
npm run dev
```

O Vue abre pelo Vite e o Express fica na porta `3001`. O arquivo `data/cinemaneiro.sqlite` aparece sozinho quando o servidor iniciar pela primeira vez.

## Onde cada coisa fica

- `src/`: telas e componentes Vue.
- `server/models/`: consultas e regras que mexem nos dados.
- `server/controllers/`: o que cada rota faz.
- `server/routes/`: endereços da API.
- `server/middleware/`: autenticação e permissões.
- `server/db.js`: cria as tabelas e abre o SQLite.
- `server/config/`: armazenamento das sessões.
- `server/seeds/filmes.sql`: carga inicial em SQL, usada só se a tabela `movies` estiver vazia.
- `data/cinemaneiro.sqlite`: banco de verdade, onde os filmes e os outros dados ficam salvos.

## Atualizar o catálogo do IMDb

O script baixa os datasets do IMDb, monta o Top 1000 e grava os dados direto na tabela `movies` do SQLite:

```bash
npm run importar:imdb
```

Ele atualiza os filmes existentes e adiciona os que ainda não estão no banco. A tela não importa mais a lista de filmes de um arquivo JS/JSON: ela busca tudo pela API `/api/movies`.

## Tela de detalhes e avaliações

Cada filme tem uma tela interna com sinopse, imagens e trailer vindos do TMDB. O usuário precisa estar logado pra publicar uma nota de 0 a 10 e um comentário. Cada pessoa pode manter uma avaliação por filme e atualizar depois. Administradores podem remover avaliações; a permissão é conferida no servidor, não só escondida na interface.

O token do TMDB fica no `.env` do servidor. Não coloque esse token em nenhum arquivo dentro de `src/`.

## Banco de dados

Faça backup de `data/cinemaneiro.sqlite` antes de mexer no banco ou atualizar o catálogo. Não apague esse arquivo se quiser manter contas, listas e avaliações.

## Build

```bash
npm run build
npm start
```
