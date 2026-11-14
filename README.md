### O fim do monolito chegou senhores...


<img width="516" height="594" alt="image" src="https://github.com/user-attachments/assets/33b3eb8e-613d-45e2-822c-b8f4064428ec" />

#### como ficou:

- `src/`: telas e componentes Vue.
- `server/models/`: consultas e regras que mexem nos dados.
- `server/controllers/`: o que cada rota faz.
- `server/routes/`: endereços da API.
- `server/middleware/`: autenticação e permissões.
- `server/db.js`: cria as tabelas e abre o SQLite.
- `server/config/`: armazenamento das sessões.
- `server/seeds/filmes.sql`: carga inicial em SQL, usada só se a tabela `movies` estiver vazia.
- `data/cinemaneiro.sqlite`: banco de verdade, onde os filmes e os outros dados ficam salvos.


###### chatgpt é um verdadeiro herói
