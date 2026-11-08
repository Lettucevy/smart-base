// ============================================================================
// src/index.js
// Demonstração Completa do MVP Smart-Base (Recuperação de Informação)
// Executa:
// 1. Verificação/Compilação do Coprocessador Nativo na linguagem HP-HL
// 2. Seeding se necessário (5.000 chamados + artigos + embeddings 1536d)
// 3. Criação Estruturada e Transacional de Chamado (Trilha A)
// 4. Recuperação Semântica e Fluxo RAG (Trilha C)
// ============================================================================

const fs = require("fs");
const { SNAPSHOT_PATH, closeConnections } = require("./db");
const { runSeed } = require("./seed");
const { criarChamadoEstruturado } = require("./create-ticket");
const { executeRagPipeline } = require("./rag");

async function runFullDemo() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    await runSeed();
  }

  console.log("\n▶ ETAPA 1: Demonstrando Criação Estruturada e Validação Transacional (Trilha A)...");
  const novo = await criarChamadoEstruturado({
    titulo: "Arquivo PNG lido com read_file vem incompleto por causa de bytes NUL no cabeçalho",
    descricao:
      "Ao tentar calcular o hash ou carregar os bytes de uma textura PNG no motor gráfico em HP-HL, a string para no primeiro byte zero.",
    trechoCodigoHphl: "ptr dst = mem_alloc(16384);\nint n = read_bytes(\"icon.png\", dst, 16384);",
    prioridade: "ALTA",
  });
  console.log(
    `   ✔ Criado protocolo ${novo.chamado.protocolo} -> Classificado pelo motor HP-HL como [${novo.hphlProfile.codigoDiagnostico}] em ${novo.hphlProfile.elapsedUs} µs!`
  );

  console.log(
    "\n▶ ETAPA 2: Demonstrando Busca Semântica por Contexto — Exemplo do Edital ('senha esquecida' <-> 'recuperar acesso')..."
  );
  const rag1 = await executeRagPipeline(
    "Esqueci minha senha corporativa e não consigo entrar no sistema"
  );
  console.log(rag1.respostaGerada);

  console.log(
    "\n▶ ETAPA 3: Demonstrando Diagnóstico Semântico de Bug Crítico da Linguagem HP-HL..."
  );
  const rag2 = await executeRagPipeline(
    "Meu executável HP-HL fecha com erro 0xC0000374 quando duas tasks alocam listas ao mesmo tempo"
  );
  console.log(rag2.respostaGerada);

  await closeConnections();
}

if (require.main === module) {
  runFullDemo().catch((err) => {
    console.error("❌ Erro na demonstração:", err);
    process.exit(1);
  });
}
