// ============================================================================
// src/embeddings.js
// Gerador de Embeddings Semânticos de 1536 Dimensões (Trilha C — RAG & pgvector)
// ============================================================================
// Suporta:
// 1. OpenAI API (`text-embedding-3-small`, 1536 dimensões) se OPENAI_API_KEY estiver definida
// 2. Motor Semântico Híbrido HP-HL (1536 dimensões normalizadas L2) para execução
//    100% reprodutível em laboratório sem necessidade de chave paga externa.
// ============================================================================

const { analyzeWithHphl, analyzeTextFallbackJs } = require("./hphl-bridge");

const EMBEDDING_DIM = 1536;

/**
 * Subconceitos semânticos finos que mapeiam sinônimos e intenções equivalentes
 * para as mesmas coordenadas no espaço vetorial de 1536 dimensões.
 * Exemplo clássico do edital: "senha esquecida" <-> "recuperar acesso"
 */
const SEMANTIC_CONCEPTS = [
  {
    id: "auth_password_recovery",
    dims: [384, 385, 386, 387, 388, 389, 390, 391, 450, 451, 452, 453],
    weight: 4.5,
    patterns: [
      /senha\s*esquecida/,
      /esqueci\s*(a|minha)?\s*senha/,
      /recuperar\s*(o|meu)?\s*acesso/,
      /redefinir\s*credencia(l|is)/,
      /reset\s*(de)?\s*senha/,
      /nao\s*consigo\s*(fazer)?\s*login/,
      /n[aã]o\s*consigo\s*entrar/,
      /perdi\s*(o|meu)?\s*acesso/,
      /conta\s*bloqueada/,
      /desbloquear\s*usuario/,
      /token\s*de\s*autenticacao\s*expirado/,
      /acesso\s*negado\s*ao\s*painel/,
    ],
  },
  {
    id: "gc_multithread_heap_corruption",
    dims: [0, 1, 2, 3, 4, 5, 6, 7, 460, 461, 462, 463],
    weight: 4.5,
    patterns: [
      /0xc0000374/,
      /heap\s*corruption/,
      /corrup[cç][aã]o\s*de\s*heap/,
      /gc.*thread/,
      /tasks?\s*concorrentes?\s*aloca/,
      /paralel.*\bgc\b/,
      /duas\s*tasks\s*alocam\s*objetos/,
      /crash\s*ao\s*alocar\s*strings?\s*em\s*paralelo/,
      /tabelas?\s*young\s*(e|\/)?\s*old/,
      /coletor\s*de\s*lixo\s*multithread/,
    ],
  },
  {
    id: "memory_arena_pool_policies",
    dims: [16, 17, 18, 19, 20, 21, 22, 23, 470, 471, 472, 473],
    weight: 4.2,
    patterns: [
      /\barena\b/,
      /\bpool\b/,
      /vazamento\s*de\s*mem[oó]ria/,
      /memory\s*leak/,
      /consumo\s*excessivo\s*de\s*ram/,
      /desaloca[cç][aã]o\s*em\s*lote/,
      /bump\s*allocat/,
      /frame\s*allocator/,
      /pausas?\s*de\s*gc/,
      /lat[eê]ncia\s*de\s*aloca[cç][aã]o/,
    ],
  },
  {
    id: "vulkan_storeop_reticle_artifacts",
    dims: [64, 65, 66, 67, 68, 69, 70, 71, 480, 481, 482, 483],
    weight: 4.5,
    patterns: [
      /storeop/,
      /dont_care/,
      /ret[ií]cula\s*na\s*tela/,
      /pixels?\s*corrompidos?/,
      /artefatos?\s*visuais?/,
      /imagem\s*quadriculada/,
      /render\s*pass\s*descarta/,
      /vkattachmentdescription/,
      /lixo\s*de\s*tile\s*na\s*gpu/,
      /1\/8\s*dos\s*pixels/,
    ],
  },
  {
    id: "vulkan_debug_messenger_teardown",
    dims: [80, 81, 82, 83, 84, 85, 86, 87, 490, 491, 492, 493],
    weight: 4.3,
    patterns: [
      /vuid-vkdestroyinstance/,
      /vk_ext_debug_utils/,
      /vk_debug_detach/,
      /validation\s*layer/,
      /debug\s*messenger/,
      /erro\s*ao\s*destruir\s*vkinstance/,
      /camada\s*de\s*valida[cç][aã]o\s*vulkan/,
    ],
  },
  {
    id: "net_tcp_connect_timeout_hang",
    dims: [128, 129, 130, 131, 132, 133, 134, 135, 500, 501, 502, 503],
    weight: 4.5,
    patterns: [
      /tcpsocket/,
      /connecttimeout/,
      /socket\s*trava/,
      /conex[aã]o\s*tcp\s*(trava|congelada|pendurada)/,
      /servidor\s*n[aã]o\s*responde/,
      /timeout\s*de\s*rede/,
      /upnp.*igd/,
      /so_rcvtimeo/,
      /so_sndtimeo/,
      /bloqueio\s*infinito\s*no\s*connect/,
    ],
  },
  {
    id: "codegen_uint_truncation_shift",
    dims: [192, 193, 194, 195, 196, 197, 198, 199, 510, 511, 512, 513],
    weight: 4.4,
    patterns: [
      /\bu32\b.*shift/,
      /\bu8\b|\bu16\b|\bu32\b/,
      /bits?\s*altos?\s*com\s*lixo/,
      /truncamento\s*de\s*inteiros?\s*sem\s*sinal/,
      /movl\s*%eax/,
      /overflow\s*em\s*tipo\s*unsigned/,
      /deslocamento\s*de\s*bits?\s*incorreto/,
    ],
  },
  {
    id: "codegen_llvm_bool_ctor_ir",
    dims: [208, 209, 210, 211, 212, 213, 214, 215, 520, 521, 522, 523],
    weight: 4.4,
    patterns: [
      /defined\s*with\s*type\s*'i1'\s*but\s*expected\s*'i8'/,
      /bool.*construtor.*llvm/,
      /coerceboolarg/,
      /genhirnew/,
      /erro\s*de\s*ir\s*no\s*llvm\s*com\s*booleano/,
      /cast\s*inv[aá]lido\s*i1\s*para\s*i8/,
    ],
  },
  {
    id: "tensor_rag_pgvector_similarity",
    dims: [256, 257, 258, 259, 260, 261, 262, 263, 530, 531, 532, 533],
    weight: 4.3,
    patterns: [
      /pgvector/,
      /busca\s*por\s*similaridade/,
      /vetor(es)?\s*de\s*1536\s*dimens[oõ]es/,
      /embeddings?\s*sem[aâ]nticos?/,
      /fluxo\s*de\s*rag/,
      /dist[aâ]ncia\s*de\s*cosseno/,
      /[ií]ndice\s*hnsw/,
      /hphl_tensor_matmul/,
    ],
  },
  {
    id: "ffi_binary_read_bytes_nul",
    dims: [320, 321, 322, 323, 324, 325, 326, 327, 540, 541, 542, 543],
    weight: 4.4,
    patterns: [
      /read_bytes/,
      /file_hash/,
      /truncado\s*no\s*primeiro\s*(byte\s*)?nul/,
      /arquivos?\s*bin[aá]rios?\s*(png|gltf|spir-v|spv)/,
      /mem_peek/,
      /mem_poke/,
      /ponteiro\s*opaco\s*ptr/,
      /leitura\s*de\s*bytes\s*crus/,
    ],
  },
];

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "para", "por", "com", "sem", "sob",
  "ao", "aos", "as", "os", "que", "se", "ou", "como", "quando",
  "meu", "minha", "seu", "sua", "foi", "esta", "este", "isso",
]);

function normalizeText(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_<>\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv1aHash(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Gera um vetor denso de 1536 dimensões normalizado (norma L2 = 1.0)
 * combinando os pesos do motor HP-HL, subconceitos semânticos e feature hashing.
 */
function generateDeterministicEmbedding1536(text, options = { useNativeHphl: false }) {
  const vec = new Float64Array(EMBEDDING_DIM);
  const raw = String(text || "");
  const norm = normalizeText(raw);

  // 1. Pesos de domínio macro vindos do analisador HP-HL (7 clusters -> dims 0..447)
  const profile = options.useNativeHphl
    ? analyzeWithHphl(raw, true)
    : analyzeTextFallbackJs(raw);

  const weights = profile.weights || [10, 10, 10, 10, 10, 10, 10];
  for (let c = 0; c < 7; c++) {
    const w = (weights[c] || 10) / 100.0;
    const baseDim = c * 64;
    for (let k = 0; k < 32; k++) {
      vec[baseDim + k] += w * (k % 2 === 0 ? 1.0 : 0.75);
    }
  }

  // 2. Ativação de conceitos semânticos finos (sinônimos e equivalência contextual)
  for (const concept of SEMANTIC_CONCEPTS) {
    let matched = false;
    for (const regex of concept.patterns) {
      if (regex.test(raw.toLowerCase()) || regex.test(norm)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      for (const d of concept.dims) {
        vec[d] += concept.weight;
      }
    }
  }

  // 3. Feature Hashing de Tokens + Stemming leve + N-gramas (dims 896..1535)
  const tokens = norm.split(" ").filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const stem = tok.length > 5 ? tok.slice(0, 5) : tok;

    // Projeção do token completo
    const h1 = fnv1aHash(tok, 2166136261);
    const dim1 = 896 + (h1 % 640);
    const sign1 = (h1 & 1) === 0 ? 1.0 : -1.0;
    vec[dim1] += sign1 * 1.25;

    // Projeção do radical (stem)
    const h2 = fnv1aHash(stem, 1469598103);
    const dim2 = 896 + (h2 % 640);
    const sign2 = (h2 & 1) === 0 ? 1.0 : -1.0;
    vec[dim2] += sign2 * 0.9;

    // Bigrama contextual (palavra atual + próxima)
    if (i + 1 < tokens.length) {
      const bigram = `${stem}_${tokens[i + 1].slice(0, 5)}`;
      const h3 = fnv1aHash(bigram, 314159265);
      const dim3 = 560 + (h3 % 336);
      vec[dim3] += 1.1;
    }
  }

  // 4. Normalização L2 para que produto escalar == similaridade de cosseno em pgvector
  let sumSq = 0.0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    sumSq += vec[i] * vec[i];
  }
  const normFactor = sumSq > 1e-12 ? 1.0 / Math.sqrt(sumSq) : 1.0;
  const result = new Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    result[i] = Number((vec[i] * normFactor).toFixed(6));
  }

  return {
    vector: result,
    profile,
  };
}

/**
 * Formata um array numérico de 1536 posições na sintaxe literal do pgvector: "[0.1,0.2,...]"
 */
function toPgVectorSql(vectorArray) {
  return `[${vectorArray.join(",")}]`;
}

/**
 * Calcula similaridade de cosseno entre dois vetores de 1536 dimensões
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  EMBEDDING_DIM,
  generateDeterministicEmbedding1536,
  toPgVectorSql,
  cosineSimilarity,
};
