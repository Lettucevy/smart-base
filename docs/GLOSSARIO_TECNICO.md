# 📖 8. Glossário Explicativo (Conceitos e Onde Estão Implementados no Projeto)

**Projeto:** Smart-Base (Catálogo de Conhecimento Corporativo & Helpdesk Semântico HP-HL)  
**Disciplina:** Banco de Dados e Modelos de Gerenciamento — Prof. Willen Leolatto Carneiro

Abaixo estão todos os termos do **Item 8 (Glossário Explicativo)** das diretrizes do projeto, acompanhados de sua definição conceitual e de **como e onde cada conceito foi implementado na prática** dentro do repositório `smart-base`:

---

## 1. Docker / Contêineres
- **Definição:** Tecnologia que permite empacotar o banco de dados e suas configurações, garantindo que o sistema rode da mesma forma no computador de todos.
- **Onde está no nosso projeto:**
  - Arquivo [`docker-compose.yml`](../docker-compose.yml): Orquestra dois contêineres isolados em rede própria:
    1. `smartbase-postgres` (Imagem `pgvector/pgvector:pg16` na porta `5432`)
    2. `smartbase-pgadmin` (Imagem `dpage/pgadmin4:latest` na porta `5050`)
  - Arquivo [`docker/init-db.sql`](../docker/init-db.sql): Script executado automaticamente no boot do contêiner para habilitar as extensões `vector` e `pg_trgm`.

---

## 2. Embeddings (Vetores)
- **Definição:** Representação matemática de um texto (lista de números de ponto flutuante). Permite que o sistema entenda o significado semântico da frase — por exemplo, reconhecendo que *"senha esquecida"* e *"recuperar acesso"* tratam exatamente do mesmo assunto, mesmo sem compartilhar palavras idênticas.
- **Onde está no nosso projeto:**
  - Arquivo [`src/embeddings.js`](../src/embeddings.js): Converte o texto de cada artigo e chamado em um **vetor denso normalizado L2 de 1536 dimensões** (`vector(1536)`).
  - Arquivo [`hphl/smartdiag_engine.hphl`](../hphl/smartdiag_engine.hphl): Coprocessador nativo compilado na linguagem **HP-HL** que extrai os pesos semânticos dos 7 domínios técnicos em **~220 microssegundos**.

---

## 3. `pgvector`
- **Definição:** Extensão oficial para o PostgreSQL que permite armazenar, indexar e consultar vetores de alta dimensão diretamente nas tabelas relacionais, essencial para bancos de dados de Inteligência Artificial.
- **Onde está no nosso projeto:**
  - Arquivo [`prisma/migrations/20261108000000_init_smartbase_pgvector/migration.sql`](../prisma/migrations/20261108000000_init_smartbase_pgvector/migration.sql): Habilita `CREATE EXTENSION IF NOT EXISTS vector;`, cria as colunas `"embedding" vector(1536)` nas tabelas `documentos` e `chamados`, e cria os índices **HNSW** (`USING hnsw ("embedding" vector_cosine_ops)`).
  - Arquivo [`src/search.js`](../src/search.js): Executa consultas SQL utilizando o operador `<=>` (distância de cosseno do `pgvector`).

---

## 4. RAG (Retrieval-Augmented Generation)
- **Definição:** Técnica onde a Inteligência Artificial "pesquisa" informações reais e confiáveis no banco de dados local (PostgreSQL) antes de formular uma resposta fundamentada ao usuário, evitando alucinações.
- **Onde está no nosso projeto:**
  - Arquivo [`src/rag.js`](../src/rag.js): Recebe o problema do usuário, busca no PostgreSQL via `pgvector` o artigo oficial mais próximo (`documentos`) e os chamados históricos já resolvidos (`chamados`), e monta o diagnóstico técnico completo com a solução validada e o trecho de código em **HP-HL**.

---

## 5. ORM (Object-Relational Mapping)
- **Definição:** Ferramenta que converte as tabelas do banco de dados relacional em objetos tipados no código, facilitando inserções, validações transacionais, migrações de schema e consultas seguras.
- **Onde está no nosso projeto:**
  - Arquivo [`prisma/schema.prisma`](../prisma/schema.prisma): Define os modelos `Usuario`, `Categoria`, `Documento`, `Chamado`, `InteracaoChamado`, `Tag` e `ChamadoTag` (Trilha A — Prisma ORM).
  - Arquivo [`src/create-ticket.js`](../src/create-ticket.js): Utiliza `prisma.$transaction` para validar e persistir novos chamados e suas interações de forma atômica (ACID).

---

## 6. Seeders / Mock Data
- **Definição:** Scripts automatizados responsáveis por popular o banco de dados inicial com milhares de dados fictícios realistas para testar e comprovar a performance de busca do sistema.
- **Onde está no nosso projeto:**
  - Arquivo [`src/seed.js`](../src/seed.js) e [`src/knowledge-catalog.js`](../src/knowledge-catalog.js): Gera e insere automaticamente em lotes (`BATCH_SIZE = 250`) **5.000 chamados de suporte**, **7 artigos técnicos**, **7 categorias**, **8 usuários** e **8 tags** com seus respectivos vetores de 1536 dimensões em cerca de **5 segundos**.

---

## 7. Full-Text Search vs. Busca Vetorial Semântica
- **Definição:** *Full-Text Search* é a técnica de pesquisar palavras-chave dentro de grandes blocos de texto ignorando preposições (presente em motores como Elasticsearch da Trilha B ou `pg_trgm`). No nosso projeto (Trilha C), fomos além da busca textual exata implementando a **Busca Semântica Vetorial** com `pgvector`, que recupera documentos pelo **contexto e intenção**, complementada pela extensão `pg_trgm` habilitada no banco.

---

## 8. MVP (Minimum Viable Product)
- **Definição:** Produto Mínimo Viável — a versão fundamental e funcional do projeto que entrega e comprova o valor principal da arquitetura de dados.
- **Onde está no nosso projeto:**
  - Scripts de terminal ([`src/seed.js`](../src/seed.js), [`src/search.js`](../src/search.js), [`src/rag.js`](../src/rag.js), [`src/create-ticket.js`](../src/create-ticket.js)) e o painel demonstrativo ([`src/server.js`](../src/server.js) / `http://localhost:3000`).
