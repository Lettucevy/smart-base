// ============================================================================
// src/server.js
// Servidor HTTP Demonstrativo para Apresentação (API REST + Painel HTML)
// Conecta a interface web diretamente ao PostgreSQL 16 (pgvector), Prisma ORM
// e ao Coprocessador Nativo compilado em HP-HL (smartdiag_engine.exe).
// ============================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const {
  getPrisma,
  getPgPool,
  checkPostgresConnection,
  loadLocalStore,
} = require("./db");
const { semanticSearch } = require("./search");
const { executeRagPipeline } = require("./rag");
const { criarChamadoEstruturado } = require("./create-ticket");
const { ensureHphlBinary, runHphlBenchmark } = require("./hphl-bridge");

const PORT = parseInt(process.env.WEB_PORT || "3000", 10);
const PUBLIC_DIR = path.resolve(__dirname, "../public");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("JSON inválido no corpo da requisição."));
      }
    });
    req.on("error", reject);
  });
}

async function getDatabaseStats() {
  const pgCheck = await checkPostgresConnection();
  const hphlStatus = ensureHphlBinary(false);

  if (pgCheck.connected) {
    const pool = getPgPool();
    const [chCount, docCount, catCount, usrCount, recentTickets] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM chamados;"),
      pool.query("SELECT COUNT(*)::int AS total FROM documentos;"),
      pool.query("SELECT COUNT(*)::int AS total FROM categorias;"),
      pool.query("SELECT COUNT(*)::int AS total FROM usuarios;"),
      pool.query(`
        SELECT ch.id, ch.protocolo, ch.titulo, ch.status, ch.prioridade,
               c.nome AS categoria, d.codigo_diagnostico AS diagnostico,
               ch.criado_em AS "criadoEm"
        FROM chamados ch
        INNER JOIN categorias c ON c.id = ch.categoria_id
        LEFT JOIN documentos d ON d.id = ch.documento_base_id
        ORDER BY ch.id DESC
        LIMIT 8;
      `),
    ]);

    return {
      postgresConnected: true,
      engineMode: "PostgreSQL 16 + pgvector (Índice HNSW Ativo)",
      hphlNativeActive: hphlStatus.available,
      hphlBinary: hphlStatus.binaryPath ? path.basename(hphlStatus.binaryPath) : "JS Fallback",
      embeddingDimensions: 1536,
      counts: {
        chamados: chCount.rows[0].total,
        documentos: docCount.rows[0].total,
        categorias: catCount.rows[0].total,
        usuarios: usrCount.rows[0].total,
      },
      recentTickets: recentTickets.rows,
    };
  }

  const store = loadLocalStore();
  return {
    postgresConnected: false,
    engineMode: "Espelho Vetorial Local (Fallback Offline)",
    hphlNativeActive: hphlStatus.available,
    hphlBinary: hphlStatus.binaryPath ? path.basename(hphlStatus.binaryPath) : "JS Fallback",
    embeddingDimensions: 1536,
    counts: {
      chamados: store ? store.chamados.length : 0,
      documentos: store ? store.documentos.length : 0,
      categorias: store ? store.categorias.length : 0,
      usuarios: store ? store.usuarios.length : 0,
    },
    recentTickets: store ? store.chamados.slice(-8).reverse() : [],
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // 1. Status geral do banco, Prisma, pgvector e motor HP-HL
    if (req.method === "GET" && url.pathname === "/api/stats") {
      const stats = await getDatabaseStats();
      return sendJson(res, 200, stats);
    }

    // 2. Busca Semântica + Fluxo RAG (Trilha C)
    if (req.method === "POST" && url.pathname === "/api/rag") {
      const body = await readRequestBody(req);
      const query = String(body.query || "").trim();
      if (!query) {
        return sendJson(res, 400, { error: "Informe uma pergunta ou problema para buscar." });
      }
      const ragResult = await executeRagPipeline(query);
      return sendJson(res, 200, ragResult);
    }

    // 3. Criação Estruturada e Transacional de Chamado (Trilha A + C)
    if (req.method === "POST" && url.pathname === "/api/tickets") {
      const body = await readRequestBody(req);
      const created = await criarChamadoEstruturado({
        titulo: body.titulo,
        descricao: body.descricao,
        trechoCodigoHphl: body.trechoCodigoHphl,
        prioridade: body.prioridade || "ALTA",
        autorEmail: body.autorEmail || "lucas.ferreira@gamedev-studio.com.br",
      });
      return sendJson(res, 201, created);
    }

    // 4. Benchmark do Coprocessador Nativo HP-HL
    if (req.method === "POST" && url.pathname === "/api/benchmark") {
      const bench = runHphlBenchmark();
      return sendJson(res, 200, bench);
    }

    // 5. Servir a interface demonstrativa (public/index.html)
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const htmlPath = path.join(PUBLIC_DIR, "index.html");
      const html = fs.readFileSync(htmlPath, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }

    sendJson(res, 404, { error: "Rota não encontrada." });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erro interno no servidor." });
  }
});

server.listen(PORT, () => {
  console.log("================================================================================");
  console.log(`🌐 SMART-BASE WEB DEMO ATIVO EM: http://localhost:${PORT}`);
  console.log("   • Banco de Dados: PostgreSQL 16 + pgvector (1536 dimensões / HNSW)");
  console.log("   • ORM: Prisma Client (Transações ACID)");
  console.log("   • Coprocessador Nativo: HP-HL SmartDiag Engine (smartdiag_engine.exe)");
  console.log("================================================================================");
});
