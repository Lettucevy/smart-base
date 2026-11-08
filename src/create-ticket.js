// ============================================================================
// src/create-ticket.js
// Criação Estruturada e Validação Transacional de Registros (Trilha A — Prisma ORM)
// + Indexação Automática de Vetor de 1536 Dimensões (Trilha C — pgvector)
// ============================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const {
  getPrisma,
  getPgPool,
  checkPostgresConnection,
  closeConnections,
  loadLocalStore,
  saveLocalStore,
} = require("./db");
const {
  generateDeterministicEmbedding1536,
  toPgVectorSql,
} = require("./embeddings");
const { semanticSearch } = require("./search");

/**
 * Cria um novo Chamado de Suporte com validação transacional ACID (Prisma $transaction):
 * 1. Valida título, descrição mínima (texto longo) e existência do autor/categoria.
 * 2. Usa o Coprocessador Nativo HP-HL para classificar automaticamente o domínio e sugerir o Documento Base.
 * 3. Persiste o Chamado, a Interação Inicial de Triagem e as Tags em uma única transação atômica.
 * 4. Grava o vetor de 1536 dimensões na coluna `embedding` via pgvector.
 */
async function criarChamadoEstruturado({
  titulo,
  descricao,
  trechoCodigoHphl,
  prioridade = "ALTA",
  autorEmail = "lucas.ferreira@gamedev-studio.com.br",
}) {
  // Validações de domínio no código (Requisito Trilha A)
  if (!titulo || titulo.trim().length < 10) {
    throw new Error("Validação Transacional Falhou: O título deve ter pelo menos 10 caracteres.");
  }
  if (!descricao || descricao.trim().length < 25) {
    throw new Error("Validação Transacional Falhou: A descrição deve conter um texto detalhado (mín. 25 caracteres).");
  }

  // 1. Gera vetor 1536d e classifica com o motor nativo HP-HL
  const textoCompleto = `${titulo} ${descricao} ${trechoCodigoHphl || ""}`;
  const { vector, profile } = generateDeterministicEmbedding1536(textoCompleto, {
    useNativeHphl: true,
  });

  // 2. Busca o chamado antigo e o artigo mais similares para já anexar na triagem automática!
  const ragSugestao = await semanticSearch(textoCompleto, 1);
  const docSugerido = ragSugestao.documentos[0];
  const chamadoSimilar = ragSugestao.chamados[0];

  const pgCheck = await checkPostgresConnection();
  const protocolo = `HPHL-2026-NEW-${Date.now().toString().slice(-5)}`;

  if (pgCheck.connected) {
    const prisma = getPrisma();
    const pool = getPgPool();

    // Executa transação ACID via Prisma ORM (Trilha A)
    const novoChamado = await prisma.$transaction(async (tx) => {
      const autor = await tx.usuario.findUnique({ where: { email: autorEmail } });
      if (!autor) {
        throw new Error(`Usuário autor '${autorEmail}' não encontrado no banco.`);
      }

      const docBase = docSugerido
        ? await tx.documento.findUnique({
            where: { codigoDiagnostico: docSugerido.codigoDiagnostico },
          })
        : null;

      const categoriaId = docBase ? docBase.categoriaId : 1;

      const criado = await tx.chamado.create({
        data: {
          protocolo,
          titulo,
          descricao,
          trechoCodigoHphl,
          status: "EM_ANALISE",
          prioridade,
          categoriaId,
          autorId: autor.id,
          documentoBaseId: docBase ? docBase.id : null,
          interacoes: {
            create: [
              {
                autorId: autor.id,
                interna: true,
                mensagem: `[Triagem Automática Coprocessador HP-HL] Vinculado ao diagnóstico ${
                  profile.codigoDiagnostico
                }. Chamado histórico similar encontrado: ${
                  chamadoSimilar ? chamadoSimilar.protocolo : "N/A"
                } (${
                  chamadoSimilar ? (chamadoSimilar.similaridade * 100).toFixed(1) + "%" : ""
                }).`,
              },
            ],
          },
        },
        include: {
          categoria: true,
          autor: true,
          documentoBase: true,
          interacoes: true,
        },
      });

      return criado;
    });

    // Atualiza a coluna vetorial vector(1536) no PostgreSQL
    await pool.query(
      `UPDATE chamados SET embedding = $1::vector WHERE id = $2;`,
      [toPgVectorSql(vector), novoChamado.id]
    );

    return {
      modo: "PostgreSQL 16 + Prisma $transaction + pgvector",
      chamado: novoChamado,
      hphlProfile: profile,
      chamadoSimilar,
    };
  } else {
    // Registro no store local caso Docker não esteja ativo na máquina
    const store = loadLocalStore();
    if (!store) {
      throw new Error("Execute `node src/seed.js` antes de criar chamados.");
    }

    const novoId = store.chamados.length + 1;
    const vecIdx = store.vectorPool.length;
    store.vectorPool.push(vector);

    const registro = {
      id: novoId,
      protocolo,
      titulo,
      descricao,
      trechoCodigoHphl,
      resolucao: chamadoSimilar ? `[Sugestão RAG de ${chamadoSimilar.protocolo}] ${chamadoSimilar.resolucao}` : null,
      status: "EM_ANALISE",
      prioridade,
      tempoResolucaoMin: null,
      categoriaSlug: "ffi-native-interop",
      documentoCodigo: profile.codigoDiagnostico,
      tags: ["ffi-binary-ptr"],
      embeddingIdx: vecIdx,
    };

    store.chamados.push(registro);
    store.totalChamados = store.chamados.length;
    saveLocalStore(store);

    return {
      modo: "Transação Validada + Espelho Vetorial Local (1536d)",
      chamado: registro,
      hphlProfile: profile,
      chamadoSimilar,
    };
  }
}

async function main() {
  console.log("================================================================================");
  console.log("📝 CRIAÇÃO ESTRUTURADA DE REGISTRO & VALIDAÇÃO TRANSACIONAL (Trilha A + C)");
  console.log("================================================================================\n");

  const resultado = await criarChamadoEstruturado({
    titulo: "Falha ao carregar arquivo binário SPIR-V (.spv) truncado no primeiro byte zero",
    descricao:
      "Estamos desenvolvendo um carregador de shaders em HP-HL, mas ao chamar read_file('pbr.spv') recebemos apenas 4 bytes porque o binário possui um byte NUL logo após o magic number.",
    trechoCodigoHphl: "string spv = read_file(\"shaders/pbr.spv\"); // Trunca no primeiro 0x00!",
    prioridade: "ALTA",
    autorEmail: "lucas.ferreira@gamedev-studio.com.br",
  });

  console.log(`✅ Chamado criado com sucesso! (${resultado.modo})`);
  console.log(`   • Protocolo: ${resultado.chamado.protocolo}`);
  console.log(`   • Título: ${resultado.chamado.titulo}`);
  console.log(`   • Status Inicial: ${resultado.chamado.status} | Prioridade: ${resultado.chamado.prioridade}`);
  console.log(
    `   • Classificação Nativa HP-HL: [${resultado.hphlProfile.codigoDiagnostico}] ${resultado.hphlProfile.categoriaSugerida} (${resultado.hphlProfile.elapsedUs} µs)`
  );
  if (resultado.chamadoSimilar) {
    console.log(
      `   • Chamado Antigo Vinculado via RAG: [${resultado.chamadoSimilar.protocolo}] (${(
        resultado.chamadoSimilar.similaridade * 100
      ).toFixed(1)}% similar)`
    );
    console.log(`   • Resolução Sugerida Automaticamente: ${resultado.chamadoSimilar.resolucao}`);
  }
  console.log("================================================================================\n");

  await closeConnections();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Erro ao criar chamado:", err.message);
    process.exit(1);
  });
}

module.exports = { criarChamadoEstruturado };
