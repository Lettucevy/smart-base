-- ============================================================================
-- Migration Inicial: Smart-Base (PostgreSQL 16 + Prisma ORM + pgvector 1536d)
-- ============================================================================

-- Habilita a extensão oficial pgvector (Trilha C)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('DESENVOLVEDOR', 'ANALISTA_SUPORTE', 'ENGENHEIRO_COMPILADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusChamado" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO', 'FECHADO');

-- CreateEnum
CREATE TYPE "PrioridadeChamado" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateTable: usuarios
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "departamento" VARCHAR(100) NOT NULL DEFAULT 'Engenharia HP-HL',
    "papel" "PapelUsuario" NOT NULL DEFAULT 'DESENVOLVEDOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable: categorias
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "modulo_hphl" VARCHAR(80) NOT NULL,
    "descricao" TEXT NOT NULL,
    "sla_horas" INTEGER NOT NULL DEFAULT 24,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable: documentos (Catálogo de Conhecimento / Artigos com vector(1536))
CREATE TABLE "documentos" (
    "id" SERIAL NOT NULL,
    "codigo_diagnostico" VARCHAR(40) NOT NULL,
    "titulo" VARCHAR(220) NOT NULL,
    "resumo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "versao_linguagem" VARCHAR(30) NOT NULL DEFAULT '1.4.0-dev',
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "embedding" vector(1536),

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chamados (Sistema de Helpdesk com vector(1536))
CREATE TABLE "chamados" (
    "id" SERIAL NOT NULL,
    "protocolo" VARCHAR(40) NOT NULL,
    "titulo" VARCHAR(220) NOT NULL,
    "descricao" TEXT NOT NULL,
    "trecho_codigo_hphl" TEXT,
    "resolucao" TEXT,
    "status" "StatusChamado" NOT NULL DEFAULT 'ABERTO',
    "prioridade" "PrioridadeChamado" NOT NULL DEFAULT 'MEDIA',
    "tempo_resolucao_min" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "tecnico_id" INTEGER,
    "documento_base_id" INTEGER,
    "embedding" vector(1536),

    CONSTRAINT "chamados_pkey" PRIMARY KEY ("id")
);

-- CreateTable: interacoes_chamado
CREATE TABLE "interacoes_chamado" (
    "id" SERIAL NOT NULL,
    "mensagem" TEXT NOT NULL,
    "interna" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamado_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,

    CONSTRAINT "interacoes_chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tags
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(60) NOT NULL,
    "cor_hex" VARCHAR(10) NOT NULL DEFAULT '#10B981',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chamados_tags
CREATE TABLE "chamados_tags" (
    "chamado_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "adicionado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamados_tags_pkey" PRIMARY KEY ("chamado_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE INDEX "usuarios_papel_idx" ON "usuarios"("papel");

CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

CREATE UNIQUE INDEX "documentos_codigo_diagnostico_key" ON "documentos"("codigo_diagnostico");
CREATE INDEX "documentos_categoria_id_idx" ON "documentos"("categoria_id");
CREATE INDEX "documentos_autor_id_idx" ON "documentos"("autor_id");

CREATE UNIQUE INDEX "chamados_protocolo_key" ON "chamados"("protocolo");
CREATE INDEX "chamados_categoria_id_status_idx" ON "chamados"("categoria_id", "status");
CREATE INDEX "chamados_prioridade_status_idx" ON "chamados"("prioridade", "status");
CREATE INDEX "chamados_autor_id_idx" ON "chamados"("autor_id");
CREATE INDEX "chamados_documento_base_id_idx" ON "chamados"("documento_base_id");

CREATE INDEX "interacoes_chamado_chamado_id_idx" ON "interacoes_chamado"("chamado_id");

CREATE UNIQUE INDEX "tags_nome_key" ON "tags"("nome");

-- Índices Vetoriais HNSW (Hierarchical Navigable Small World) para busca por similaridade de cosseno em O(log N)
CREATE INDEX "documentos_embedding_hnsw_idx" ON "documentos" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "chamados_embedding_hnsw_idx" ON "chamados" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chamados" ADD CONSTRAINT "chamados_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_documento_base_id_fkey" FOREIGN KEY ("documento_base_id") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "interacoes_chamado" ADD CONSTRAINT "interacoes_chamado_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interacoes_chamado" ADD CONSTRAINT "interacoes_chamado_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chamados_tags" ADD CONSTRAINT "chamados_tags_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_tags" ADD CONSTRAINT "chamados_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
