// ============================================================================
// src/search.js
// Motor de Busca Semântica Vetorial em 1536 Dimensões (Trilha C — pgvector)
// Operador de Distância de Cosseno (<=>) + Coprocessador Nativo HP-HL
// ============================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const {
  getPgPool,
  checkPostgresConnection,
  closeConnections,
  loadLocalStore,
} = require("./db");
const {
  generateDeterministicEmbedding1536,
  toPgVectorSql,
  cosineSimilarity,
} = require("./embeddings");

/**
 * Realiza busca por similaridade semântica (vetores de 1536 dimensões)
 * tanto na tabela `documentos` (Catálogo de Conhecimento) quanto em `chamados` (Helpdesk).
 */
async function semanticSearch(queryText, topK = 5) {
  const t0 = process.hrtime.bigint();

  // 1. Gera o vetor de 1536 dimensões e invoca o analisador nativo HP-HL
  const { vector, profile } = generateDeterministicEmbedding1536(queryText, {
    useNativeHphl: true,
  });

  const pgCheck = await checkPostgresConnection();
  let documentosEncontrados = [];
  let chamadosEncontrados = [];
  let fonteDados = "PostgreSQL 16 + pgvector (Índice HNSW)";

  if (pgCheck.connected) {
    const pool = getPgPool();
    const vecLit = toPgVectorSql(vector);

    // Consulta 1: Artigos Oficiais na tabela `documentos` ordenados por distância de cosseno (<=>)
    const docRes = await pool.query(
      `SELECT
          d.id,
          d.codigo_diagnostico AS "codigoDiagnostico",
          d.titulo,
          d.resumo,
          d.conteudo,
          c.nome AS "categoriaNome",
          u.nome AS "autorNome",
          ROUND((1 - (d.embedding <=> $1::vector))::numeric, 4) AS similaridade
       FROM documentos d
       INNER JOIN categorias c ON c.id = d.categoria_id
       INNER JOIN usuarios u ON u.id = d.autor_id
       WHERE d.embedding IS NOT NULL
       ORDER BY d.embedding <=> $1::vector ASC
       LIMIT $2;`,
      [vecLit, Math.min(topK, 3)]
    );
    documentosEncontrados = docRes.rows.map((r) => ({
      ...r,
      similaridade: parseFloat(r.similaridade),
    }));

    // Consulta 2: Chamados Resolvidos na tabela `chamados` ordenados por distância de cosseno (<=>)
    const chamadosRes = await pool.query(
      `SELECT
          ch.id,
          ch.protocolo,
          ch.titulo,
          ch.descricao,
          ch.resolucao,
          ch.trecho_codigo_hphl AS "trechoCodigoHphl",
          ch.status,
          ch.prioridade,
          ch.tempo_resolucao_min AS "tempoResolucaoMin",
          c.nome AS "categoriaNome",
          d.codigo_diagnostico AS "documentoCodigo",
          ROUND((1 - (ch.embedding <=> $1::vector))::numeric, 4) AS similaridade
       FROM chamados ch
       INNER JOIN categorias c ON c.id = ch.categoria_id
       LEFT JOIN documentos d ON d.id = ch.documento_base_id
       WHERE ch.embedding IS NOT NULL AND ch.resolucao IS NOT NULL
       ORDER BY ch.embedding <=> $1::vector ASC, ch.id ASC
       LIMIT $2;`,
      [vecLit, topK]
    );
    chamadosEncontrados = chamadosRes.rows.map((r) => ({
      ...r,
      similaridade: parseFloat(r.similaridade),
    }));
  } else {
    // Fallback sobre o espelho vetorial local de 5.000 registros (caso Docker não esteja rodando)
    const store = loadLocalStore();
    if (!store) {
      throw new Error(
        "Base de dados ainda não populada. Execute primeiro: node src/seed.js"
      );
    }
    fonteDados = `Motor Vetorial Local (${store.totalChamados.toLocaleString("pt-BR")} registros x ${store.embeddingDimensions}d)`;

    const poolVecs = store.vectorPool;
    const catBySlug = new Map(store.categorias.map((c) => [c.slug, c.nome]));
    const userByEmail = new Map(store.usuarios.map((u) => [u.email, u.nome]));

    documentosEncontrados = store.documentos
      .map((d) => {
        const docVec = poolVecs[d.embeddingIdx];
        const sim = cosineSimilarity(vector, docVec);
        return {
          id: d.id,
          codigoDiagnostico: d.codigoDiagnostico,
          titulo: d.titulo,
          resumo: d.resumo,
          conteudo: d.conteudo,
          categoriaNome: catBySlug.get(d.categoriaSlug) || d.categoriaSlug,
          autorNome: userByEmail.get(d.autorEmail) || d.autorEmail,
          similaridade: Number(sim.toFixed(4)),
        };
      })
      .sort((a, b) => b.similaridade - a.similaridade)
      .slice(0, Math.min(topK, 3));

    chamadosEncontrados = store.chamados
      .filter((ch) => Boolean(ch.resolucao))
      .map((ch) => {
        const chVec = poolVecs[ch.embeddingIdx];
        const sim = cosineSimilarity(vector, chVec);
        return {
          id: ch.id,
          protocolo: ch.protocolo,
          titulo: ch.titulo,
          descricao: ch.descricao,
          resolucao: ch.resolucao,
          trechoCodigoHphl: ch.trechoCodigoHphl,
          status: ch.status,
          prioridade: ch.prioridade,
          tempoResolucaoMin: ch.tempoResolucaoMin,
          categoriaNome: catBySlug.get(ch.categoriaSlug) || ch.categoriaSlug,
          documentoCodigo: ch.documentoCodigo,
          canonico: Boolean(ch.canonico),
          similaridade: Number(sim.toFixed(4)),
        };
      })
      .sort((a, b) => {
        if (Math.abs(b.similaridade - a.similaridade) > 0.08) {
          return b.similaridade - a.similaridade;
        }
        if (a.canonico !== b.canonico) {
          return a.canonico ? -1 : 1;
        }
        return b.similaridade - a.similaridade;
      })
      .slice(0, topK);
  }

  const elapsedMs = Number((process.hrtime.bigint() - t0) / 1000000n);

  return {
    query: queryText,
    fonteDados,
    elapsedMs,
    hphlProfile: profile,
    documentos: documentosEncontrados,
    chamados: chamadosEncontrados,
  };
}

function printSearchResult(res) {
  console.log("--------------------------------------------------------------------------------");
  console.log(`🔎 CONSULTA SEMÂNTICA: "${res.query}"`);
  console.log(`⚙️  Coprocessador HP-HL: ${res.hphlProfile.engine} (${res.hphlProfile.elapsedUs} µs)`);
  console.log(
    `🎯 Diagnóstico Inferido: [${res.hphlProfile.codigoDiagnostico}] — ${res.hphlProfile.categoriaSugerida}`
  );
  console.log(`🗄️  Fonte Vetorial: ${res.fonteDados} | Tempo Total: ${res.elapsedMs} ms`);
  console.log("--------------------------------------------------------------------------------");

  console.log("\n📘 ARTIGOS DO CATÁLOGO DE CONHECIMENTO MAIS RELEVANTES (Tabela `documentos`):");
  for (const doc of res.documentos) {
    const pct = (doc.similaridade * 100).toFixed(1);
    console.log(
      `   • [${pct}% similar] [${doc.codigoDiagnostico}] ${doc.titulo} (Autor: ${doc.autorNome})`
    );
    console.log(`     Resumo: ${doc.resumo}`);
  }

  console.log("\n🎫 CHAMADOS ANTIGOS RECUPERADOS POR CONTEXTO (Tabela `chamados`):");
  for (const ch of res.chamados) {
    const pct = (ch.similaridade * 100).toFixed(1);
    console.log(
      `   • [${pct}% similar] [${ch.protocolo}] (${ch.status} | ${ch.prioridade}) ${ch.titulo}`
    );
    if (ch.resolucao) {
      console.log(`     ✅ Solução Aplicada: ${ch.resolucao}`);
    }
  }
  console.log("");
}

async function main() {
  const cliQuery = process.argv.slice(2).join(" ").trim();
  const queries = cliQuery
    ? [cliQuery]
    : [
        // Caso 1: Exemplo literal do Glossário do Prof. Willen ("senha esquecida" <-> "recuperar acesso")
        "Esqueci minha senha e não consigo fazer login no painel de pacotes",
        // Caso 2: Bug real de memória concorrente na linguagem HP-HL
        "Meu programa fechou sozinho quando duas threads alocaram listas ao mesmo tempo",
        // Caso 3: Bug visual no renderizador Vulkan da HP-HL
        "A imagem renderizada na GPU está quadriculada com pixels corrompidos",
        // Caso 4: Problema de rede TCP travando
        "Minha conexão de socket fica congelada para sempre esperando o roteador responder",
      ];

  for (const q of queries) {
    const res = await semanticSearch(q, 3);
    printSearchResult(res);
  }

  await closeConnections();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Erro na busca semântica:", err.message);
    process.exit(1);
  });
}

module.exports = { semanticSearch, printSearchResult };
