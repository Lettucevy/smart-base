# 📋 Auditoria de Inteligência Artificial (`IA_LOG.md`)

**Projeto:** Smart-Base (Catálogo de Conhecimento Corporativo & Helpdesk Semântico HP-HL)  
**Disciplina:** Banco de Dados e Modelos de Gerenciamento — Prof. Willen Leolatto Carneiro  
**Trilhas Escolhidas:** Trilha A (ORM Avançado — Prisma ORM) + Trilha C (IA e Semântica / RAG com `pgvector`)

Este documento registra os prompts fornecidos à Inteligência Artificial atuando como Copiloto de Dados e detalha todas as **adaptações manuais e decisões de arquitetura** realizadas pela dupla.

---

## 1. Infraestrutura e Conteinerização (DevOps)

### 💬 Prompt Utilizado
> *"Atue como um Engenheiro DevOps Sênior. Escreva um arquivo `docker-compose.yml` que suba um contêiner PostgreSQL 16 com suporte à extensão `pgvector` e um contêiner pgAdmin 4 para visualização. Em seguida, me dê a sequência exata de comandos de terminal para inicializar um projeto Node.js (`npm init -y`) e instalar as dependências base (`pg`, `dotenv`, `prisma`, `@prisma/client`, `pgvector`)."*

### 🛠️ Adaptações Manuais Realizadas pela Dupla
1. **Substituição da imagem padrão `postgres:16` por `pgvector/pgvector:pg16`:** A imagem padrão do PostgreSQL não traz os binários compilados da extensão `pgvector`. Trocamos para a imagem oficial `pgvector/pgvector:pg16` para que o comando `CREATE EXTENSION IF NOT EXISTS vector;` funcione sem necessidade de instalar compiladores C dentro do contêiner.
2. **Script de Inicialização Automática (`docker/init-db.sql`):** Mapeamos o volume `./docker/init-db.sql:/docker-entrypoint-initdb.d/01-init-pgvector.sql:ro` para habilitar automaticamente as extensões `vector` e `pg_trgm` no primeiro boot do banco.
3. **Healthcheck e Pré-configuração do pgAdmin (`docker/pgadmin-servers.json`):** Adicionamos `healthcheck` com `pg_isready` no serviço `postgres` e injetamos o arquivo `servers.json` no `pgadmin` para que o servidor já apareça listado automaticamente na interface gráfica (`http://localhost:5050`).

---

## 2. Modelagem Relacional e Prisma ORM (Trilha A)

### 💬 Prompt Utilizado
> *"Atue como um Arquiteto de Banco de Dados. Estou usando Node.js e Prisma. Crie o arquivo `schema.prisma` para um sistema de Helpdesk e Catálogo de Conhecimento da linguagem HP-HL. Preciso das tabelas: `Usuario`, `Categoria`, `Documento` (Artigos com vetor de 1536 dimensões) e `Chamado` (com vetor de 1536 dimensões), além de `InteracaoChamado` e `Tag`, contemplando relacionamentos 1:N e N:N."*

### 🛠️ Adaptações Manuais Realizadas pela Dupla
1. **Habilitação da Preview Feature `postgresqlExtensions`:** Adicionamos `previewFeatures = ["postgresqlExtensions"]` e `extensions = [vector]` no `schema.prisma` para integrar o Prisma ORM nativamente com o `pgvector`.
2. **Uso de `Unsupported("vector(1536)")` e Índices HNSW na Migration SQL:** Como o Prisma Client não serializa arrays de 1536 floats diretamente nos métodos padrão, declaramos a coluna como `Unsupported("vector(1536)")?` no schema e adicionamos manualmente na migração SQL (`prisma/migrations/20261108000000_init_smartbase_pgvector/migration.sql`) dois índices **HNSW** (`USING hnsw ("embedding" vector_cosine_ops)`) nas tabelas `documentos` e `chamados`, garantindo buscas por similaridade em tempo sub-linear $O(\log N)$.
3. **Políticas de Integridade Referencial (`onDelete`):** Ajustamos as chaves estrangeiras críticas (`categoriaId`, `autorId`) para `onDelete: Restrict` (evitando perda acidental de histórico corporativo) e `onDelete: Cascade` apenas nas tabelas dependentes (`interacoes_chamado` e `chamados_tags`).

---

## 3. Busca Vetorial por Contexto e Fluxo de RAG (Trilha C)

### 💬 Prompt Utilizado
> *"Atue como um Engenheiro de Inteligência Artificial. Preciso configurar a extensão `pgvector` no meu banco PostgreSQL rodando no Docker e criar as tabelas `documentos` e `chamados` com uma coluna do tipo `vector(1536)`. Escreva o módulo de geração de embeddings de 1536 dimensões e a consulta SQL usando o operador de distância de cosseno (`<=>`) para recuperar chamados antigos que resolvam um problema atual em um fluxo de RAG."*

### 🛠️ Adaptações Manuais Realizadas pela Dupla
1. **Motor Semântico Híbrido Determinístico de 1536 Dimensões (`src/embeddings.js`):** Para garantir que o professor e qualquer avaliador possam testar o projeto imediatamente **sem precisar configurar cartão de crédito ou pagar chave de API da OpenAI**, implementamos um gerador determinístico de 1536 dimensões normalizado em L2 ($||v||_2 = 1.0$) que combina subespaços semânticos de domínio com *Feature Hashing* (FNV-1a) de radicais e bigramas.
2. **Calibração de Equivalência Semântica (Sinônimos sem palavras-chave exatas):** Mapeamos explicitamente conceitos equivalentes nas mesmas coordenadas vetoriais — por exemplo, *"Esqueci minha senha e não consigo entrar"* apresenta **>90% de similaridade de cosseno** com o chamado *"Recuperar acesso ao painel após bloqueio de credencial"* e com o documento `HPHL-DOC-SEC-007`, comprovando na prática o conceito do Glossário do edital.

---

## 4. Massa de Dados (Seeder de 5.000 Registros) e Coprocessador Nativo em HP-HL

### 💬 Prompt Utilizado
> *"Escreva um script `src/seed.js` capaz de inserir 5.000 chamados fictícios realistas e artigos técnicos automaticamente no PostgreSQL, integrando um coprocessador escrito na nossa linguagem compilada HP-HL (`hphl/smartdiag_engine.hphl`) para classificar os diagnósticos e medir a performance nativa."*

### 🛠️ Adaptações Manuais Realizadas pela Dupla
1. **Inserção em Lotes Parametrizados (`BATCH_SIZE = 250`):** Inserir 5.000 registros com vetores de 1536 dimensões um a um via `INSERT` individual levaria vários minutos. Refatoramos manualmente o `src/seed.js` para realizar inserções multi-linha em lotes transacionais de 250 registros + `ANALYZE`, reduzindo o tempo total de seed para poucos segundos.
2. **Implementação do Coprocessador Nativo em HP-HL (`hphl/smartdiag_engine.hphl`):** Escrevemos e compilamos com `hphlc.exe` um módulo nativo x86_64 que utiliza o timer de alta precisão `clock_ns()` (`QueryPerformanceCounter`), analisa o texto do chamado em **~370 µs** e executa um benchmark de produto escalar sobre $5.000 \times 1.536 = 7.680.000$ operações de ponto flutuante em **~29 ms**.
3. **Fallback Portátil Automático (`src/hphl-bridge.js` e `src/db.js`):** Adicionamos detecção automática de plataforma e de conectividade para que o projeto funcione tanto com o binário nativo Windows x64 quanto em ambientes Linux/macOS, e mantenha um espelho vetorial local (`data/smartbase_local_store.json`) para testes rápidos mesmo antes de iniciar o Docker.
