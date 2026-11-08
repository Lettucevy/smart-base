// ============================================================================
// src/rag.js
// Fluxo Completo de RAG (Retrieval-Augmented Generation) — Trilha C
// Recupera Artigos + Chamados Antigos no PostgreSQL (pgvector) e formula
// uma resposta técnica fundamentada com código na linguagem HP-HL.
// ============================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { semanticSearch } = require("./search");
const { closeConnections } = require("./db");

async function executeRagPipeline(perguntaUsuario) {
  // Etapa 1: Retrieval (Recuperação Vetorial em 1536 dimensões + Coprocessador HP-HL)
  const retrieval = await semanticSearch(perguntaUsuario, 3);

  const topDoc = retrieval.documentos[0];
  const topChamado = retrieval.chamados[0];

  // Etapa 2: Augmented Prompt Construction (Montagem do Contexto Recuperado)
  const contextoRecuperado = {
    documentoReferencia: topDoc
      ? `[${topDoc.codigoDiagnostico}] ${topDoc.titulo} (Similaridade: ${(
          topDoc.similaridade * 100
        ).toFixed(1)}%)`
      : "Nenhum artigo encontrado",
    chamadoHistorico: topChamado
      ? `[${topChamado.protocolo}] ${topChamado.titulo} (Similaridade: ${(
          topChamado.similaridade * 100
        ).toFixed(1)}%)`
      : "Nenhum chamado encontrado",
  };

  // Etapa 3: Generation (Formulação da Resposta Baseada nos Dados Reais do Banco Local)
  const respostaGerada = `
================================================================================
🤖 RESPOSTA FORMULADA PELO ASSISTENTE RAG SMART-BASE (HP-HL Copilot)
================================================================================
📌 PERGUNTA / INCIDENTE DO USUÁRIO:
   "${perguntaUsuario}"

🔍 1. CONTEXTO RECUPERADO DO BANCO DE DADOS (pgvector 1536d):
   • Motor Nativo HP-HL: ${retrieval.hphlProfile.engine} (${retrieval.hphlProfile.elapsedUs} µs)
   • Artigo Oficial Base: ${contextoRecuperado.documentoReferencia}
   • Chamado Antigo Equivalente: ${contextoRecuperado.chamadoHistorico}
   • Tempo de Recuperação Vetorial: ${retrieval.elapsedMs} ms (${retrieval.fonteDados})

🧠 2. DIAGNÓSTICO TÉCNICO FUNDAMENTADO:
   Com base no artigo oficial ${topDoc ? topDoc.codigoDiagnostico : "N/A"} (escrito por ${
    topDoc ? topDoc.autorNome : "Engenharia"
  }) e no histórico do chamado resolvido ${
    topChamado ? topChamado.protocolo : "N/A"
  }:
   ${topDoc ? topDoc.resumo : ""}

🛠️  3. SOLUÇÃO PRÁTICA RECOMENDADA (Validada em ${
    topChamado && topChamado.tempoResolucaoMin
      ? topChamado.tempoResolucaoMin + " min no chamado " + topChamado.protocolo
      : "produção"
  }):
   ${topChamado && topChamado.resolucao ? topChamado.resolucao : "Consulte o guia oficial."}

💻 4. TRECHO DE CÓDIGO / COMANDO DE REFERÊNCIA EM HP-HL:
--------------------------------------------------------------------------------
${
  topChamado && topChamado.trechoCodigoHphl
    ? topChamado.trechoCodigoHphl
    : "// Sem snippet adicional"
}
--------------------------------------------------------------------------------
================================================================================`;

  return {
    retrieval,
    respostaGerada,
  };
}

async function main() {
  const input =
    process.argv.slice(2).join(" ").trim() ||
    "Estou recebendo erro 0xC0000374 quando uso parallel para criar strings em várias threads na linguagem HP-HL";

  const { respostaGerada } = await executeRagPipeline(input);
  console.log(respostaGerada);
  await closeConnections();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Erro no pipeline RAG:", err);
    process.exit(1);
  });
}

module.exports = { executeRagPipeline };
