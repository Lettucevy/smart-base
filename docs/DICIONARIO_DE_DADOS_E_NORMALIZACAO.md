# 📘 Dicionário de Dados e Justificativa de Normalização (1FN, 2FN e 3FN)

**Projeto:** Smart-Base (Catálogo de Conhecimento Corporativo & Helpdesk Semântico HP-HL)  
**Banco de Dados:** PostgreSQL 16 + Extensão `pgvector`  
**ORM:** Prisma ORM (Trilha A)

---

## 1. Justificativa das Formas Normais (Critério 7.1 — Arquitetura e Normalização)

A modelagem relacional do banco `smartbase_db` foi projetada seguindo rigorosamente as três primeiras formas normais:

1. **Primeira Forma Normal (1FN — Atomicidade e Ausência de Grupos Repetitivos):**
   - Todos os atributos das tabelas armazenam valores atômicos (indivisíveis).
   - **Exemplo prático:** Em vez de armazenar múltiplas tags separadas por vírgula dentro da tabela `chamados` (o que violaria a 1FN), criamos a entidade `tags` e a tabela associativa `chamados_tags`. Da mesma forma, o histórico de mensagens de um chamado foi isolado na tabela `interacoes_chamado` (relacionamento `1:N`).
2. **Segunda Forma Normal (2FN — Dependência Funcional Total da Chave Primária):**
   - Todas as tabelas estão na 1FN e todo atributo não-chave depende funcionalmente da chave primária inteira (sem dependências parciais).
   - **Exemplo prático:** Na tabela associativa `chamados_tags` (cuja chave primária composta é `(chamado_id, tag_id)`), o atributo `adicionado_em` depende do vínculo específico entre aquele chamado e aquela tag, enquanto o nome e a cor da tag (`nome`, `cor_hex`) ficam isolados na tabela `tags`.
3. **Terceira Forma Normal (3FN — Ausência de Dependências Transitivas):**
   - Nenhum atributo não-chave depende de outro atributo não-chave.
   - **Exemplo prático:** Dados do autor (`nome`, `email`, `departamento`, `papel`) não são duplicados dentro de `chamados` ou `documentos` (referenciados apenas por `autor_id`). Da mesma forma, o SLA e o módulo da linguagem (`sla_horas`, `modulo_hphl`) pertencem exclusivamente à tabela `categorias` (referenciada por `categoria_id`).

---

## 2. Dicionário de Dados Detalhado

### 2.1. Tabela `usuarios` (Model Prisma: `Usuario`)
Armazena os autores de artigos da base de conhecimento, desenvolvedores relatores de chamados e engenheiros de suporte.

| Coluna | Tipo PostgreSQL | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL (INTEGER)` | `PRIMARY KEY` | Identificador único auto-incrementado do usuário. |
| `nome` | `VARCHAR(120)` | `NOT NULL` | Nome completo do colaborador ou desenvolvedor. |
| `email` | `VARCHAR(160)` | `NOT NULL, UNIQUE` | E-mail corporativo único (usado como chave natural de busca). |
| `departamento` | `VARCHAR(100)` | `NOT NULL, DEFAULT` | Área técnica (ex.: *Runtime, GC & Memory Systems*). |
| `papel` | `ENUM PapelUsuario` | `NOT NULL` | Perfil: `DESENVOLVEDOR`, `ANALISTA_SUPORTE`, `ENGENHEIRO_COMPILADOR`, `ADMIN`. |
| `ativo` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Indica se a conta está ativa no ecossistema. |
| `criado_em` | `TIMESTAMP(3)` | `NOT NULL, DEFAULT NOW()` | Data e hora de cadastro. |

---

### 2.2. Tabela `categorias` (Model Prisma: `Categoria`)
Representa os 7 subdomínios técnicos da linguagem compilada HP-HL.

| Coluna | Tipo PostgreSQL | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL (INTEGER)` | `PRIMARY KEY` | Identificador único da categoria. |
| `nome` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | Nome de exibição da categoria técnica. |
| `slug` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | Identificador amigável para URL/CLI (ex.: `memory-policies-gc`). |
| `modulo_hphl` | `VARCHAR(80)` | `NOT NULL` | Módulo correspondente no compilador/runtime HP-HL. |
| `descricao` | `TEXT` | `NOT NULL` | Escopo detalhado dos problemas cobertos pela categoria. |
| `sla_horas` | `INTEGER` | `NOT NULL, DEFAULT 24` | Tempo máximo de resposta acordado (SLA em horas). |
| `criado_em` | `TIMESTAMP(3)` | `NOT NULL, DEFAULT NOW()` | Data e hora de criação. |

---

### 2.3. Tabela `documentos` (Model Prisma: `Documento`)
Catálogo de Conhecimento Corporativo contendo os artigos oficiais de diagnóstico da linguagem HP-HL e seus vetores semânticos.

| Coluna | Tipo PostgreSQL | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL (INTEGER)` | `PRIMARY KEY` | Identificador único do documento/artigo. |
| `codigo_diagnostico` | `VARCHAR(40)` | `NOT NULL, UNIQUE` | Código oficial do artigo (ex.: `HPHL-DOC-MEM-001`, `HPHL-DOC-SEC-007`). |
| `titulo` | `VARCHAR(220)` | `NOT NULL` | Título técnico do artigo. |
| `resumo` | `TEXT` | `NOT NULL` | Síntese executiva usada na triagem RAG. |
| `conteudo` | `TEXT` | `NOT NULL` | Texto longo completo em Markdown com exemplos de código `.hphl`. |
| `versao_linguagem` | `VARCHAR(30)` | `NOT NULL, DEFAULT '1.4.0-dev'` | Versão da linguagem HP-HL à qual o artigo se aplica. |
| `visualizacoes` | `INTEGER` | `NOT NULL, DEFAULT 0` | Contador de acessos ao artigo. |
| `publicado` | `BOOLEAN` | `NOT NULL, DEFAULT true` | Status de publicação no catálogo. |
| `categoria_id` | `INTEGER` | `NOT NULL, FK -> categorias(id)` | Categoria técnica do artigo (`ON DELETE RESTRICT`). |
| `autor_id` | `INTEGER` | `NOT NULL, FK -> usuarios(id)` | Engenheiro autor do documento (`ON DELETE RESTRICT`). |
| `embedding` | `vector(1536)` | `INDEX HNSW (vector_cosine_ops)` | Vetor denso normalizado L2 de **1536 dimensões** (`pgvector`). |
| `criado_em` | `TIMESTAMP(3)` | `NOT NULL, DEFAULT NOW()` | Data de publicação. |
| `atualizado_em` | `TIMESTAMP(3)` | `NOT NULL` | Última revisão do artigo. |

---

### 2.4. Tabela `chamados` (Model Prisma: `Chamado`)
Armazena os **5.000+ tickets de suporte técnico** do Helpdesk com seus respectivos embeddings vetoriais para recuperação por similaridade.

| Coluna | Tipo PostgreSQL | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL (INTEGER)` | `PRIMARY KEY` | Identificador interno do chamado. |
| `protocolo` | `VARCHAR(40)` | `NOT NULL, UNIQUE` | Código único de rastreamento (ex.: `HPHL-2026-00001`). |
| `titulo` | `VARCHAR(220)` | `NOT NULL` | Resumo do incidente relatado. |
| `descricao` | `TEXT` | `NOT NULL` | Relato detalhado do problema, sintomas e ambiente operacional. |
| `trecho_codigo_hphl` | `TEXT` | `NULLABLE` | Snippet de código `.hphl` ou log de terminal anexado pelo usuário. |
| `resolucao` | `TEXT` | `NULLABLE` | Descrição técnica da solução definitiva aplicada ao chamado. |
| `status` | `ENUM StatusChamado` | `NOT NULL` | Estado: `ABERTO`, `EM_ANALISE`, `RESOLVIDO`, `FECHADO`. |
| `prioridade` | `ENUM PrioridadeChamado` | `NOT NULL` | Severidade: `BAIXA`, `MEDIA`, `ALTA`, `CRITICA`. |
| `tempo_resolucao_min` | `INTEGER` | `NULLABLE` | Tempo gasto até a resolução (em minutos). |
| `categoria_id` | `INTEGER` | `NOT NULL, FK -> categorias(id)` | Categoria técnica do chamado (`ON DELETE RESTRICT`). |
| `autor_id` | `INTEGER` | `NOT NULL, FK -> usuarios(id)` | Usuário relator do chamado (`ON DELETE RESTRICT`). |
| `tecnico_id` | `INTEGER` | `NULLABLE, FK -> usuarios(id)` | Analista/Engenheiro responsável pelo atendimento (`ON DELETE SET NULL`). |
| `documento_base_id` | `INTEGER` | `NULLABLE, FK -> documentos(id)` | Artigo oficial que fundamentou a resolução (`ON DELETE SET NULL`). |
| `embedding` | `vector(1536)` | `INDEX HNSW (vector_cosine_ops)` | Vetor denso normalizado L2 de **1536 dimensões** (`pgvector`). |
| `criado_em` | `TIMESTAMP(3)` | `NOT NULL, DEFAULT NOW()` | Data/hora de abertura. |
| `atualizado_em` | `TIMESTAMP(3)` | `NOT NULL` | Data/hora da última atualização. |

---

### 2.5. Tabelas Complementares (`interacoes_chamado`, `tags`, `chamados_tags`)

- **`interacoes_chamado`**: Registra cada mensagem/comentário técnico ou nota automática de triagem dentro de um chamado (`id`, `mensagem`, `interna`, `chamado_id`, `autor_id`, `criado_em`).
- **`tags`**: Catálogo de rótulos técnicos (`id`, `nome`, `cor_hex`).
- **`chamados_tags`**: Tabela associativa `N:N` com chave primária composta `(chamado_id, tag_id)` e carimbo de tempo `adicionado_em`.

---

## 3. Índices de Desempenho (B-Tree e HNSW Vetorial)

| Nome do Índice | Tabela | Tipo | Colunas / Operador | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| `documentos_embedding_hnsw_idx` | `documentos` | **HNSW (`pgvector`)** | `embedding vector_cosine_ops` | Busca aproximada de vizinhos mais próximos (ANN) por distância de cosseno em $O(\log N)$. |
| `chamados_embedding_hnsw_idx` | `chamados` | **HNSW (`pgvector`)** | `embedding vector_cosine_ops` | Recuperação ultrarrápida de chamados similares entre 5.000+ vetores de 1536 dimensões. |
| `chamados_categoria_id_status_idx` | `chamados` | **B-Tree Composto** | `(categoria_id, status)` | Acelera filtros combinados de chamados resolvidos por categoria. |
| `chamados_prioridade_status_idx` | `chamados` | **B-Tree Composto** | `(prioridade, status)` | Acelera triagem de fila de atendimento por criticidade. |
