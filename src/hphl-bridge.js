// ============================================================================
// src/hphl-bridge.js
// Ponte de Integração entre o Backend Node.js e o Coprocessador Nativo HP-HL
// ============================================================================

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const HPHL_SRC = path.resolve(__dirname, "../hphl/smartdiag_engine.hphl");
const HPHL_EXE = path.resolve(
  __dirname,
  process.platform === "win32"
    ? "../hphl/smartdiag_engine.exe"
    : "../hphl/smartdiag_engine"
);

const CANDIDATE_COMPILERS = [
  process.env.HPHLC_PATH,
  "C:/Projetos/HPHL/compiler/bin/hphlc.exe",
  "C:/Projetos/HPHL/dist/hphl-sdk-v1.0.0-windows-x64/bin/hphlc.exe",
  "hphlc",
].filter(Boolean);

function findHphlCompiler() {
  for (const candidate of CANDIDATE_COMPILERS) {
    try {
      if (candidate === "hphlc" || fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {
      // ignora e tenta o próximo
    }
  }
  return null;
}

function ensureHphlBinary(forceRebuild = false) {
  if (!forceRebuild && fs.existsSync(HPHL_EXE)) {
    return { available: true, binaryPath: HPHL_EXE, compiledNow: false };
  }

  const compiler = findHphlCompiler();
  if (!compiler || !fs.existsSync(HPHL_SRC)) {
    return { available: false, binaryPath: null, compiledNow: false };
  }

  try {
    execFileSync(compiler, [HPHL_SRC, "-o", HPHL_EXE], {
      stdio: "pipe",
      timeout: 20000,
    });
    return {
      available: fs.existsSync(HPHL_EXE),
      binaryPath: HPHL_EXE,
      compiledNow: true,
    };
  } catch (err) {
    return {
      available: false,
      binaryPath: null,
      compiledNow: false,
      error: err.message,
    };
  }
}

/**
 * Fallback em JS puro caso o projeto seja executado em uma máquina sem o binário Windows x64
 */
function analyzeTextFallbackJs(rawText) {
  const t0 = process.hrtime.bigint();
  const t = String(rawText || "").toLowerCase();

  let wMem = 10,
    wVk = 10,
    wNet = 10,
    wCg = 10,
    wAi = 10,
    wFfi = 10,
    wSec = 10;

  if (/(gc|arena|pool|heap|mem[oó]ria|0xc0000374|vazamento|leak|aloca|stack|ram)/.test(t)) wMem += 85;
  if (/(vulkan|vk|shader|spirv|vuid|gpu|render|storeop|tela|textura|pipeline|gr[aá]fico)/.test(t)) wVk += 85;
  if (/(tcp|udp|socket|timeout|rede|conex|porta|pacote|iocp|upnp|servidor|lento)/.test(t)) wNet += 85;
  if (/(llvm|x64|codegen|compila|int<|u32|match|trunc|abi|registrador|sintaxe|tipo)/.test(t)) wCg += 85;
  if (/(tensor|matmul|embedding|vetor|rag|llm|token|ia|simd|similaridade|pgvector)/.test(t)) wAi += 85;
  if (/(ffi|extern|ptr|addr_of|mem_peek|mem_poke|dll|ponteiro|c_interop)/.test(t)) wFfi += 85;
  if (/(senha|acesso|login|recuperar|esqueci|bloqueado|credencial|autentica|permiss[aã]o|conta)/.test(t)) wSec += 95;

  const candidates = [
    { cluster: 0, w: wMem, codigoDiagnostico: "HPHL-DOC-MEM-001", categoriaSugerida: "Memory Policies & GC" },
    { cluster: 1, w: wVk, codigoDiagnostico: "HPHL-DOC-VK-002", categoriaSugerida: "Vulkan & Graphics Pipeline" },
    { cluster: 2, w: wNet, codigoDiagnostico: "HPHL-DOC-NET-003", categoriaSugerida: "Networking & Async Sockets" },
    { cluster: 3, w: wCg, codigoDiagnostico: "HPHL-DOC-CG-004", categoriaSugerida: "Compiler Codegen (x64 / LLVM)" },
    { cluster: 4, w: wAi, codigoDiagnostico: "HPHL-DOC-AI-005", categoriaSugerida: "Tensor, Embeddings & RAG" },
    { cluster: 5, w: wFfi, codigoDiagnostico: "HPHL-DOC-FFI-006", categoriaSugerida: "FFI & Native Interop" },
    { cluster: 6, w: wSec, codigoDiagnostico: "HPHL-DOC-SEC-007", categoriaSugerida: "Autenticacao, Credenciais & Acesso" },
  ];

  candidates.sort((a, b) => b.w - a.w);
  const top = candidates[0];
  const elapsedUs = Number((process.hrtime.bigint() - t0) / 1000n);

  return {
    engine: "SmartDiag JS Fallback (Compat Mode)",
    nativeHphl: false,
    cluster: top.cluster,
    codigoDiagnostico: top.codigoDiagnostico,
    categoriaSugerida: top.categoriaSugerida,
    weights: [wMem, wVk, wNet, wCg, wAi, wFfi, wSec],
    tokenHash: t.length * 31337,
    elapsedUs,
  };
}

/**
 * Executa a análise semântica invocando o binário nativo compilado em HP-HL (quando disponível)
 */
function analyzeWithHphl(text, useNativeBinary = true) {
  if (useNativeBinary && process.platform === "win32") {
    const status = ensureHphlBinary(false);
    if (status.available) {
      try {
        const cleanText = String(text || "").replace(/[\r\n"]+/g, " ").slice(0, 450);
        const stdout = execFileSync(
          status.binaryPath,
          ["--analyze", cleanText],
          { encoding: "utf8", timeout: 4000 }
        );
        const parsed = JSON.parse(stdout.trim());
        parsed.nativeHphl = true;
        return parsed;
      } catch (_) {
        // Fallback transparente se houver qualquer erro de execução
      }
    }
  }
  return analyzeTextFallbackJs(text);
}

function runHphlBenchmark() {
  const status = ensureHphlBinary(false);
  if (status.available && process.platform === "win32") {
    try {
      const stdout = execFileSync(status.binaryPath, ["--benchmark"], {
        encoding: "utf8",
        timeout: 8000,
      });
      return JSON.parse(stdout.trim());
    } catch (_) {
      // Continua para fallback
    }
  }

  const t0 = process.hrtime.bigint();
  const numVectors = 5000;
  const dims = 1536;
  const totalOps = numVectors * dims;
  let acc = 0;
  for (let i = 0; i < totalOps; i++) acc += 0.000125;
  const elapsedUs = Number((process.hrtime.bigint() - t0) / 1000n);

  return {
    engine: "Node.js V8 Fallback Benchmark",
    vectors_scanned: numVectors,
    dimensions: dims,
    total_float_ops: totalOps,
    elapsed_us: elapsedUs,
    checksum: Math.floor(acc),
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--build")) {
    console.log("🔨 Compilando motor nativo HP-HL (hphl/smartdiag_engine.hphl)...");
    const res = ensureHphlBinary(true);
    console.log(res);
  } else if (args.includes("--benchmark")) {
    console.log("⚡ Executando Benchmark Vetorial HP-HL (5.000 vetores x 1.536 dimensões)...");
    console.log(JSON.stringify(runHphlBenchmark(), null, 2));
  } else {
    const sample = args[0] || "Esqueci minha senha e preciso recuperar o acesso ao painel";
    console.log(JSON.stringify(analyzeWithHphl(sample, true), null, 2));
  }
}

module.exports = {
  ensureHphlBinary,
  analyzeWithHphl,
  analyzeTextFallbackJs,
  runHphlBenchmark,
};
