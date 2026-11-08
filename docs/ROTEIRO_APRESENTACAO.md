# 🎤 Roteiro de Apresentação para a Dupla (5 a 7 Minutos)

**Disciplina:** Banco de Dados e Modelos de Gerenciamento — Prof. Willen Leolatto Carneiro

---

## 🖥️ Preparação Rápida (Antes de Chamar o Professor)

1. Certifique-se de que os contêineres Docker estão rodando:
   ```powershell
   cd C:\Projetos\smart-base
   .\docker-compose ps
   ```
2. Deixe o servidor da interface web demonstrativa ligado:
   ```powershell
   npm run web
   ```
3. Deixe abertas no navegador:
   - **Aba 1:** Painel Demonstrativo Smart-Base (`http://localhost:3000`)
   - **Aba 2:** pgAdmin 4 (`http://localhost:5050` — login `admin@smartbase.com` / `admin123`)

---

## 👤 Parte 1 — Integrante 1: Infraestrutura Docker, Modelagem 3FN e Massa de Dados (2,5 min)

1. **Apresentação do Tema (30s):**
   - *"Construímos o **Smart-Base**, o motor de Catálogo de Conhecimento e Helpdesk Técnico da nossa linguagem compilada **HP-HL**, unindo a **Trilha A (Prisma ORM Avançado)** e a **Trilha C (Busca Vetorial e RAG com `pgvector` de 1536 dimensões)**."*
2. **Infraestrutura via Docker (`docker-compose.yml`):**
   - Mostre o `.\docker-compose ps` no terminal.
   - Destaque que o contêiner `smartbase-postgres` usa a imagem `pgvector/pgvector:pg16` com healthcheck e script `docker/init-db.sql` que habilita a extensão `vector` automaticamente.
3. **Modelagem Relacional e 3ª Forma Normal (`prisma/schema.prisma` e DER):**
   - Mostre o diagrama DER no `README.md` (ou em `docs/DICIONARIO_DE_DADOS_E_NORMALIZACAO.md`).
   - Explique as **7 tabelas** (`usuarios`, `categorias`, `documentos`, `chamados`, `interacoes_chamado`, `tags`, `chamados_tags`) e os dois índices **HNSW (`vector_cosine_ops`)** criados na migration para busca em $O(\log N)$.
4. **Seeder de 5.000 Registros (`src/seed.js`):**
   - Explique que o seeder utiliza inserções em lote (`BATCH_SIZE = 250`) para popular **5.000 chamados** e **7 artigos oficiais** com vetores de 1536 dimensões em **~5 segundos**.

---

## 👤 Parte 2 — Integrante 2: Coprocessador HP-HL, Busca Semântica RAG e Transações ACID (3 min)

1. **Demonstração na Interface Web (`http://localhost:3000`) ou no Terminal:**
   - Clique no botão **⚡ Rodar Benchmark Nativo HP-HL (x64)** no topo da página `http://localhost:3000` (ou rode `npm run hphl:benchmark`).
   - Mostre o código [`hphl/smartdiag_engine.hphl`](../hphl/smartdiag_engine.hphl) e destaque que o binário nativo faz a triagem em **~220 microssegundos** e calcula 7,68 milhões de operações float em **~28 ms**.
2. **Caso Clássico do Edital: `"Esqueci minha senha"` $\leftrightarrow$ `"Recuperar acesso"`:**
   - Na interface web (`http://localhost:3000`), clique no primeiro botão de preset: **🔑 Exemplo Edital: "Esqueci minha senha..." ↔ "Recuperar acesso"** (ou rode `node src/rag.js "Esqueci minha senha corporativa e preciso acessar o painel"`).
   - Mostre que o PostgreSQL (`pgvector`) recupera com **75,5% de similaridade de cosseno** o chamado `HPHL-2026-00001` (*"Recuperar acesso ao painel após bloqueio de credencial"*) e o artigo `HPHL-DOC-SEC-007`, mesmo sem ter as palavras *"esqueci"* ou *"senha"* no título!
3. **Caso Técnico HP-HL (`0xC0000374` ou `Vulkan storeOp`):**
   - Clique no preset **💥 Bug GC Multithread (0xC0000374)** e mostre como o RAG recupera o artigo de políticas de memória da HP-HL e já sugere o código corrigido.
4. **Criação Estruturada e Transação ACID (`Prisma $transaction` — Trilha A):**
   - Na coluna direita da página web, clique em **⚡ Preencher Exemplo** e depois em **💾 Persistir no PostgreSQL via Prisma `$transaction`** (ou rode `node src/create-ticket.js`).
   - Mostre que o chamado é gravado atomicamente no PostgreSQL 16, já classificado pelo motor HP-HL e vinculado ao chamado histórico `HPHL-2026-00007` via RAG!
5. **Documentação e Auditoria (`IA_LOG.md`):**
   - Mostre rapidamente o arquivo [`IA_LOG.md`](../IA_LOG.md) e a pasta [`docs/`](./) contendo o Dicionário de Dados e a justificativa de normalização.
