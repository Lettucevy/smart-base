// ============================================================================
// src/knowledge-catalog.js
// Base de Dados Canônica do Ecossistema HP-HL:
// Categorias, Usuários, Tags, Artigos Oficiais (Documentos) e Gerador de 5.000 Chamados
// ============================================================================

const CATEGORIAS_BASE = [
  {
    nome: "Memory Policies & Garbage Collector",
    slug: "memory-policies-gc",
    moduloHphl: "runtime.gc / runtime.alloc",
    descricao:
      "Gerenciamento de memória multi-paradigma da HP-HL (stack, heap, arena, pool, shared), coletor geracional Young/Old e barreiras de escrita.",
    slaHoras: 4,
  },
  {
    nome: "Vulkan & Graphics Pipeline",
    slug: "vulkan-graphics-pipeline",
    moduloHphl: "packages.vulkan / runtime.vkdebug",
    descricao:
      "Integração nativa com Vulkan 1.3, shaders SPIR-V, validation layers (VK_EXT_debug_utils), render passes e ray queries no ProkionEngine.",
    slaHoras: 8,
  },
  {
    nome: "Networking & Async Sockets",
    slug: "networking-async-sockets",
    moduloHphl: "packages.net (Tcp / Socket / Route)",
    descricao:
      "Comunicação de rede TCP/UDP bloqueante com timeout (SO_RCVTIMEO/SO_SNDTIMEO), descoberta UPnP/NAT-PMP e E/S assíncrona via IOCP/io_uring.",
    slaHoras: 6,
  },
  {
    nome: "Compiler Codegen (x64 / LLVM)",
    slug: "compiler-codegen-x64-llvm",
    moduloHphl: "compiler.codegen / compiler.irgen",
    descricao:
      "Geração direta de código de máquina x86_64 e emissão de LLVM IR (-O0 a -O3), tipos parametrizados em bits (int<N>, float<N>, u8..u64) e pattern matching.",
    slaHoras: 8,
  },
  {
    nome: "Tensor, Embeddings & RAG",
    slug: "tensor-embeddings-rag",
    moduloHphl: "packages.tensor / packages.llm / packages.nn",
    descricao:
      "Operações matriciais aceleradas (hphl_tensor_matmul_f64), tokenização para LLMs, geração de embeddings vetoriais de 1536 dimensões e integração pgvector.",
    slaHoras: 12,
  },
  {
    nome: "FFI & Native Interop",
    slug: "ffi-native-interop",
    moduloHphl: "runtime.mem / extern C ABI",
    descricao:
      "Foreign Function Interface v2 com ponteiros opacos (ptr), addr_of, mem_alloc/peek/poke e leitura binária sem truncamento NUL (read_bytes, file_hash).",
    slaHoras: 12,
  },
  {
    nome: "Autenticacao, Credenciais & Acesso",
    slug: "autenticacao-credenciais-acesso",
    moduloHphl: "security.auth / package.registry",
    descricao:
      "Gestão de acesso ao registro de pacotes HP-HL (`hphl fetch/publish`), recuperação de senha, redefinição de credenciais SSO e tokens de API.",
    slaHoras: 2,
  },
];

const USUARIOS_BASE = [
  {
    nome: "Dra. Helena Vasconcelos",
    email: "helena.vasconcelos@hphl-lang.org",
    departamento: "Arquitetura de Compiladores & LLVM",
    papel: "ENGENHEIRO_COMPILADOR",
  },
  {
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@hphl-lang.org",
    departamento: "Runtime, GC & Memory Systems",
    papel: "ENGENHEIRO_COMPILADOR",
  },
  {
    nome: "Marina Takahashi",
    email: "marina.takahashi@hphl-lang.org",
    departamento: "Gráficos Vulkan & ProkionEngine",
    papel: "ENGENHEIRO_COMPILADOR",
  },
  {
    nome: "Rafael Nogueira",
    email: "rafael.nogueira@smartbase.io",
    departamento: "Suporte Nível 3 & Infraestrutura",
    papel: "ANALISTA_SUPORTE",
  },
  {
    nome: "Beatriz Almeida",
    email: "beatriz.almeida@smartbase.io",
    departamento: "Segurança da Informação & IAM",
    papel: "ADMIN",
  },
  {
    nome: "Lucas Ferreira",
    email: "lucas.ferreira@gamedev-studio.com.br",
    departamento: "Engenharia de Gameplay",
    papel: "DESENVOLVEDOR",
  },
  {
    nome: "Gabriel Rocha",
    email: "gabriel.rocha@fintech-core.com.br",
    departamento: "Sistemas Distribuídos de Baixa Latência",
    papel: "DESENVOLVEDOR",
  },
  {
    nome: "Juliana Costa",
    email: "juliana.costa@ai-labs.org",
    departamento: "Pesquisa em IA & Busca Vetorial",
    papel: "DESENVOLVEDOR",
  },
];

const TAGS_BASE = [
  { nome: "gc-heap-corruption", corHex: "#EF4444" },
  { nome: "memory-arena-pool", corHex: "#F59E0B" },
  { nome: "vulkan-validation", corHex: "#8B5CF6" },
  { nome: "tcp-socket-timeout", corHex: "#3B82F6" },
  { nome: "llvm-x64-codegen", corHex: "#10B981" },
  { nome: "pgvector-rag-1536d", corHex: "#EC4899" },
  { nome: "ffi-binary-ptr", corHex: "#6366F1" },
  { nome: "auth-password-reset", corHex: "#14B8A6" },
];

const DOCUMENTOS_BASE = [
  {
    codigoDiagnostico: "HPHL-DOC-MEM-001",
    titulo: "Guia de Isolamento do GC entre Tasks Concorrentes e Políticas Arena/Pool",
    categoriaSlug: "memory-policies-gc",
    autorEmail: "carlos.mendes@hphl-lang.org",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Explica a causa do erro 0xC0000374 (heap corruption) quando múltiplas tasks alocam objetos gerenciados simultaneamente e como usar buffers crus (mem_alloc) ou arenas.",
    conteudo: `## Diagnóstico HPHL-DOC-MEM-001: Concorrência no Garbage Collector e Políticas de Memória

### 1. Sintoma Comum
Aplicações que disparam múltiplas tasks concorrentes (\`spawn\` ou \`parallel\`) alocando objetos gerenciados pelo GC (\`string\`, \`class\`, \`list<T>\`) simultaneamente podem corromper as tabelas geracionais \`young/old\` e encerrar com código \`0xC0000374\` (STATUS_HEAP_CORRUPTION no Windows).

### 2. Causa Raiz
O coletor geracional da versão atual opera de forma cooperativa por thread principal. Quando duas tasks de sistema manipulam os cabeçalhos de alocação gerenciada sem sincronização, ocorre condição de corrida no remembered set.

### 3. Solução Recomendada
1. **Dentro de tasks paralelas de I/O ou rede**: Utilize buffers crus via \`mem_alloc(bytes)\` e \`mem_free(ptr)\` em vez de concatenar strings gerenciadas.
2. **Para alocações temporárias de alta frequência por frame**: Utilize a política \`arena\` (bump-allocation liberada automaticamente ao sair do escopo) ou \`pool\` (reuso em O(1)).

\`\`\`hphl
// Exemplo seguro em escopo de alta performance:
arena Particle[1000] particles;
ptr rawBuf = mem_alloc(4096);
mem_zero(rawBuf, 4096);
mem_free(rawBuf);
\`\`\``,
  },
  {
    codigoDiagnostico: "HPHL-DOC-VK-002",
    titulo: "Correção de Artefatos em Render Pass Vulkan (storeOp = STORE) e Teardown do Debug Messenger",
    categoriaSlug: "vulkan-graphics-pipeline",
    autorEmail: "marina.takahashi@hphl-lang.org",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Resolve o problema de retícula/pixels corrompidos (~1/8 correto) causado por storeOp = DONT_CARE e o erro VUID-vkDestroyInstance-instance-00629 no desligamento.",
    conteudo: `## Diagnóstico HPHL-DOC-VK-002: Persistência de Attachments e Validation Layers no Vulkan

### 1. Sintoma A: Imagem com padrão de retícula ou lixo de tiles na GPU
Quando um Render Pass limpa o attachment com \`loadOp = CLEAR\`, mas configura \`storeOp = DONT_CARE\` (valor 1), o driver descarta o resultado do tile ao final do passe, entregando lixo de memória para o passe seguinte.
- **Correção**: Utilizar os helpers atualizados (\`VkAllocAttachDesc\`, \`VkAllocAttachDescFinal\`) com \`storeOp = STORE\` (valor 0) e \`srcImageLayout = TRANSFER_SRC_OPTIMAL\` (6) no \`vkCmdCopyImageToBuffer\`.

### 2. Sintoma B: Erro VUID-vkDestroyInstance-instance-00629 ao fechar a aplicação
O \`VkDebugUtilsMessengerEXT\` é um objeto filho da \`VkInstance\`. Destruir a instância antes do messenger viola a especificação Vulkan.
- **Correção**: Invocar a builtin \`vk_debug_detach(instance)\` antes de \`vkDestroyInstance\` e garantir que a extensão \`VK_EXT_debug_utils\` esteja habilitada quando \`HPHL_VK_VALIDATION=1\`.`,
  },
  {
    codigoDiagnostico: "HPHL-DOC-NET-003",
    titulo: "Prevenção de Travamentos em Conexões de Rede com TcpSocket e ConnectTimeout",
    categoriaSlug: "networking-async-sockets",
    autorEmail: "rafael.nogueira@smartbase.io",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Como evitar bloqueio infinito em clientes HTTP/UPnP/TCP utilizando TcpSocket.ConnectTimeout, SO_RCVTIMEO/SO_SNDTIMEO e E/S assíncrona IOCP/io_uring.",
    conteudo: `## Diagnóstico HPHL-DOC-NET-003: Timeouts Determinísticos em Sockets TCP

### 1. Contexto do Problema
Dispositivos de rede (como roteadores IGD respondendo a SSDP/UPnP ou serviços externos sobrecarregados) podem responder ao broadcast UDP mas não aceitar o handshake TCP na porta anunciada, congelando chamadas \`connect()\` ou \`recv()\` bloqueantes indefinidamente.

### 2. Solução com \`net.Tcp\` (\`TcpSocket\`)
O módulo \`net.Tcp\` implementa \`hphl_tcp_connect_timeout\` (socket não-bloqueante + \`select\`) e configura \`SO_RCVTIMEO\` / \`SO_SNDTIMEO\` em todas as operações.

\`\`\`hphl
import net.Tcp;

TcpSocket sock = new TcpSocket();
if (sock.ConnectTimeout("192.168.1.1", 80, 3000)) {
    sock.SendText("GET /status HTTP/1.0\\r\\n\\r\\n");
    string resposta = sock.ReadAll(65536);
    sock.Close();
}
\`\`\``,
  },
  {
    codigoDiagnostico: "HPHL-DOC-CG-004",
    titulo: "Semântica de Inteiros Sem Sinal (u8/u16/u32), Coerção Bool no LLVM e Pattern Matching de Constantes",
    categoriaSlug: "compiler-codegen-x64-llvm",
    autorEmail: "helena.vasconcelos@hphl-lang.org",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Documenta a normalização de largura em tipos unsigned (movzbq/movl/trunc+zext), coerção i1->i8 em construtores LLVM e resolução de constantes em blocos match.",
    conteudo: `## Diagnóstico HPHL-DOC-CG-004: Regras de Codegen x64 e Emissão de LLVM IR

### 1. Truncamento de Tipos \`u8\`, \`u16\` e \`u32\`
Ambos os backends armazenam inteiros em slots de 64 bits. Na versão 1.4.0-dev, toda expressão unsigned é truncada e zero-estendida imediatamente (\`movzbq\`, \`movzwq\`, \`movl %eax, %eax\` no x64; \`trunc\` + \`zext\` no LLVM), impedindo que shifts (\`u32 x = a << 26\`) deixem lixo nos bits altos.

### 2. Erro LLVM: \`defined with type 'i1' but expected 'i8'\` em Construtores
Passar uma expressão booleana envolvendo campo (\`new Foo(this.flag == 1)\`) para um construtor exigia coerção explícita de \`i1\` para \`i8\`. O compilador agora unifica essa conversão em \`Irgen::coerceBoolArg\`.

### 3. Pattern Matching (\`match\`) com Constantes Nomeadas
Identificadores de constantes conhecidas em compile-time (\`const int K_OK = 1;\`) agora são resolvidos como padrões \`Const\`/\`StrConst\` em vez de capturarem silenciosamente como variável de binding.`,
  },
  {
    codigoDiagnostico: "HPHL-DOC-AI-005",
    titulo: "Arquitetura de Busca Vetorial Semântica (RAG) com pgvector (1536d) e Pacote Tensor HP-HL",
    categoriaSlug: "tensor-embeddings-rag",
    autorEmail: "juliana.costa@ai-labs.org",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Guia de implementação de Retrieval-Augmented Generation combinando o pacote nativo tensor/llm da HP-HL com índices HNSW e vetores de 1536 dimensões no PostgreSQL.",
    conteudo: `## Diagnóstico HPHL-DOC-AI-005: Fluxo de RAG e Similaridade de Cosseno em 1536 Dimensões

### 1. Como funciona a Busca Semântica
Ao contrário de buscas léxicas por palavra-chave (\`ILIKE\`), o fluxo de RAG converte textos longos e chamados em vetores densos normalizados de **1536 dimensões**. Conceitos equivalentes (mesmo com vocabulário distinto) ficam próximos no espaço hiperdimensional.

### 2. Operador de Distância no PostgreSQL (\`pgvector\`)
Utilizamos o operador \`<=>\` (distância de cosseno) acelerado por índice **HNSW** (\`vector_cosine_ops\`):
\`\`\`sql
SELECT id, protocolo, titulo, 1 - (embedding <=> $1::vector) AS similaridade
FROM chamados
WHERE status = 'RESOLVIDO'
ORDER BY embedding <=> $1::vector
LIMIT 5;
\`\`\``,
  },
  {
    codigoDiagnostico: "HPHL-DOC-FFI-006",
    titulo: "Leitura de Arquivos Binários com Bytes NUL (read_bytes / file_hash) e FFI v2 com Ponteiros Opacos",
    categoriaSlug: "ffi-native-interop",
    autorEmail: "carlos.mendes@hphl-lang.org",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Por que read_file trunca arquivos binários (PNG, SPIR-V, glTF) no primeiro byte zero e como usar read_bytes(path, dst, cap) e file_hash(path) na FFI v2.",
    conteudo: `## Diagnóstico HPHL-DOC-FFI-006: Manipulação Binária e Interoperabilidade C/DLL

### 1. Problema de Truncamento em \`read_file\`
Strings em HP-HL são terminadas em NUL (\`\\0\`). Quando \`read_file\` é usado em formatos binários como texturas PNG, shaders SPIR-V (\`.spv\`) ou malhas glTF, a leitura para no primeiro byte \`0x00\`.

### 2. Solução: \`read_bytes\` e \`file_hash\`
- **\`read_bytes(path, dst, cap) -> int\`**: Lê os bytes brutos diretamente para um buffer alocado com \`mem_alloc(cap)\`, retornando a contagem de bytes lidos (ou \`-1\` em erro).
- **\`file_hash(path) -> int\`**: Calcula o hash FNV-1a de 64 bits sobre todos os bytes do arquivo no disco sem truncar no primeiro NUL.`,
  },
  {
    codigoDiagnostico: "HPHL-DOC-SEC-007",
    titulo: "Procedimento de Recuperação de Acesso, Redefinição de Senha Esquecida e Desbloqueio de Credenciais",
    categoriaSlug: "autenticacao-credenciais-acesso",
    autorEmail: "beatriz.almeida@smartbase.io",
    versaoLinguagem: "1.4.0-dev",
    resumo:
      "Manual completo para recuperar acesso ao portal corporativo e registro de pacotes HP-HL em casos de senha esquecida, bloqueio por tentativas ou expiração de token.",
    conteudo: `## Diagnóstico HPHL-DOC-SEC-007: Recuperação de Acesso e Gestão de Credenciais (SSO / CLI)

### 1. Equilavência Semântica de Incidentes de Acesso
Este artigo cobre todos os incidentes relacionados a:
- **Senha esquecida / perda de senha** no portal corporativo ou CLI \`hphl login\`;
- **Recuperação de acesso** após bloqueio automático por tentativas inválidas;
- **Redefinição de credenciais** e rotação de Personal Access Tokens (PAT).

### 2. Passo a Passo de Resolução Imediata
1. Execute o comando de recuperação de credencial no terminal:
   \`hphl auth recover --email usuario@dominio.com\`
2. Para desbloqueio imediato pelo suporte Nível 1/2, revogue o token antigo na tabela de sessões e emita um link temporário de redefinição com validade de 15 minutos (SLA máximo: 2 horas).
3. Reautentique o ambiente local atualizando a chave \`HPHL_REGISTRY_TOKEN\` no arquivo \`.env\`.`,
  },
];

/**
 * Chamados Canônicos de Alta Precisão (Casos Reais que provam o valor do RAG na Apresentação)
 */
const CHAMADOS_CANONICOS = [
  {
    protocolo: "HPHL-2026-00001",
    titulo: "Recuperar acesso ao painel e registro de pacotes após bloqueio de credencial",
    descricao:
      "O desenvolvedor relatou que perdeu a senha corporativa e precisa recuperar o acesso à conta no servidor de pacotes da HP-HL. Ao tentar autenticar via CLI, recebe erro de credencial expirada ou conta temporariamente bloqueada.",
    trechoCodigoHphl: "// Terminal CLI:\n// $ hphl publish --package net\n// ERRO 401: Credencial invalida ou sessao bloqueada.",
    resolucao:
      "Aplicado procedimento HPHL-DOC-SEC-007: realizado reset de senha via SSO, desbloqueio da conta do desenvolvedor e emissão de novo token de acesso com redefinição de credenciais confirmada.",
    status: "RESOLVIDO",
    prioridade: "ALTA",
    tempoResolucaoMin: 18,
    categoriaSlug: "autenticacao-credenciais-acesso",
    documentoCodigo: "HPHL-DOC-SEC-007",
    tags: ["auth-password-reset"],
  },
  {
    protocolo: "HPHL-2026-00002",
    titulo: "Crash 0xC0000374 (Heap Corruption) ao alocar strings e listas em tasks paralelas no GC",
    descricao:
      "Durante o teste de descoberta UPnP do CompassNetwork, duas tasks concorrentes alocavam objetos gerenciados (strings e list<string>) simultaneamente. O processo encerrou abruptamente com exceção 0xC0000374 por corrupção nas tabelas young/old do Garbage Collector.",
    trechoCodigoHphl: "parallel {\n    list<string> a = new list<string>();\n    a.Add(\"pacote_1\");\n}",
    resolucao:
      "Conforme HPHL-DOC-MEM-001, substituídas as alocações gerenciadas concorrentes dentro da task de rede por buffers pré-alocados via mem_alloc(2048) e mem_free(), eliminando a contenção no GC.",
    status: "RESOLVIDO",
    prioridade: "CRITICA",
    tempoResolucaoMin: 45,
    categoriaSlug: "memory-policies-gc",
    documentoCodigo: "HPHL-DOC-MEM-001",
    tags: ["gc-heap-corruption", "memory-arena-pool"],
  },
  {
    protocolo: "HPHL-2026-00003",
    titulo: "Efeito de retícula quadriculada na tela (apenas 1/8 dos pixels corretos) no Render Pass Vulkan",
    descricao:
      "No renderizador Vulkan do ProkionEngine, a imagem apresentada na janela e no readback offscreen exibia um padrão de retícula de período 8 com lixo de memória nos demais pixels, embora o validation layer não acusasse erro.",
    trechoCodigoHphl: "ptr attach = VkAllocAttachDesc(FORMAT_RGBA8);\n// storeOp estava configurado como 1 (VK_ATTACHMENT_STORE_OP_DONT_CARE)",
    resolucao:
      "Corrigido o offset 16 de VkAttachmentDescription nos quatro helpers (VkAllocAttachDesc*) de DONT_CARE (1) para STORE (0) e ajustado srcImageLayout para TRANSFER_SRC_OPTIMAL (6), preservando os tiles renderizados.",
    status: "RESOLVIDO",
    prioridade: "ALTA",
    tempoResolucaoMin: 60,
    categoriaSlug: "vulkan-graphics-pipeline",
    documentoCodigo: "HPHL-DOC-VK-002",
    tags: ["vulkan-validation"],
  },
  {
    protocolo: "HPHL-2026-00004",
    titulo: "Processo congela indefinidamente ao conectar via TCP em roteador UPnP que não aceita conexão",
    descricao:
      "Um gateway IGD respondeu ao pacote UDP de descoberta SSDP, mas ao tentar abrir socket TCP para baixar o XML de descrição HTTP, a chamada connect() travou a aplicação inteira porque o dispositivo ignorou o SYN.",
    trechoCodigoHphl: "TcpSocket t = new TcpSocket();\nif (t.ConnectTimeout(\"192.168.1.1\", 5000, 2500)) {\n    string xml = t.ReadAll(32768);\n    t.Close();\n}",
    resolucao:
      "Migrado para o novo método TcpSocket.ConnectTimeout(host, port, ms) do pacote net.Tcp, que utiliza connect não-bloqueante com select() e configura SO_RCVTIMEO/SO_SNDTIMEO no descritor.",
    status: "RESOLVIDO",
    prioridade: "ALTA",
    tempoResolucaoMin: 30,
    categoriaSlug: "networking-async-sockets",
    documentoCodigo: "HPHL-DOC-NET-003",
    tags: ["tcp-socket-timeout"],
  },
  {
    protocolo: "HPHL-2026-00005",
    titulo: "Operação de shift em variável u32 preserva bits altos sujos no backend x64 e falha em comparações",
    descricao:
      "Ao executar u32 x = a << 26 seguido de x >> 4, o valor resultante continha até 58 bits porque o registrador de 64 bits não era truncado para 32 bits e o otimizador peephole R1 removia a instrução movl %eax, %eax.",
    trechoCodigoHphl: "u32 a = 123456;\nu32 x = a << 26;\nu32 y = x >> 4;",
    resolucao:
      "Atualizado o codegen x64 e LLVM para normalizar toda expressão unsigned com movzbq/movzwq/movl (ou trunc+zext no LLVM) e ajustado o peephole R1 para preservar movl de 32 bits (zero-extension na ABI x64).",
    status: "RESOLVIDO",
    prioridade: "MEDIA",
    tempoResolucaoMin: 40,
    categoriaSlug: "compiler-codegen-x64-llvm",
    documentoCodigo: "HPHL-DOC-CG-004",
    tags: ["llvm-x64-codegen"],
  },
  {
    protocolo: "HPHL-2026-00006",
    titulo: "Erro de compilação LLVM IR 'defined with type i1 but expected i8' ao passar comparação bool para construtor",
    descricao:
      "O build pelo backend LLVM falhava ao instanciar new PostProcessVolume(this.flag == 1), pois genHirNew emitia o resultado i1 da comparação diretamente num parâmetro i8 do construtor, enquanto o backend x64 compilava normalmente.",
    trechoCodigoHphl: "PostProcessVolume vol = new PostProcessVolume(this.enabled == 1);",
    resolucao:
      "Unificada a coerção de argumentos booleanos em Irgen::coerceBoolArg (zext/trunc conforme largura do parâmetro alvo) tanto em chamadas normais (genHirCall) quanto em construtores (genHirNew).",
    status: "RESOLVIDO",
    prioridade: "MEDIA",
    tempoResolucaoMin: 25,
    categoriaSlug: "compiler-codegen-x64-llvm",
    documentoCodigo: "HPHL-DOC-CG-004",
    tags: ["llvm-x64-codegen"],
  },
  {
    protocolo: "HPHL-2026-00007",
    titulo: "Leitura de arquivo PNG e shader SPIR-V (.spv) retorna vazia ou truncada no primeiro byte zero",
    descricao:
      "Ao carregar um binário SPIR-V ou textura PNG com read_file(path), a função parava imediatamente no primeiro byte NUL (0x00) do cabeçalho binário, impossibilitando o parser de glTF e o cálculo correto de hash de assets.",
    trechoCodigoHphl: "ptr buf = mem_alloc(65536);\nint lidos = read_bytes(\"shader.spv\", buf, 65536);\nint hash = file_hash(\"shader.spv\");",
    resolucao:
      "Utilizadas as novas builtins binárias read_bytes(path, dst, cap) e file_hash(path) (FNV-1a 64 bits sobre bytes crus), que operam sem depender de strings terminadas em NUL.",
    status: "RESOLVIDO",
    prioridade: "ALTA",
    tempoResolucaoMin: 35,
    categoriaSlug: "ffi-native-interop",
    documentoCodigo: "HPHL-DOC-FFI-006",
    tags: ["ffi-binary-ptr"],
  },
  {
    protocolo: "HPHL-2026-00008",
    titulo: "Otimização de busca semântica RAG em base com milhares de chamados usando índice HNSW no pgvector",
    descricao:
      "A consulta de similaridade semântica sobre vetores de 1536 dimensões precisava responder em menos de 15ms para sugerir diagnósticos automáticos durante a abertura de chamados de suporte.",
    trechoCodigoHphl: "// Integração Tensor HP-HL + PostgreSQL pgvector\n// Vetor normalizado L2 de 1536 dimensões consultado via operador <=>",
    resolucao:
      "Criado índice HNSW (USING hnsw (embedding vector_cosine_ops)) nas tabelas documentos e chamados e normalizados os vetores de 1536 dimensões em L2 pelo motor híbrido HP-HL.",
    status: "RESOLVIDO",
    prioridade: "BAIXA",
    tempoResolucaoMin: 20,
    categoriaSlug: "tensor-embeddings-rag",
    documentoCodigo: "HPHL-DOC-AI-005",
    tags: ["pgvector-rag-1536d"],
  },
];

/**
 * Templates de variação realista para geração em massa (5.000+ registros)
 */
const TEMPLATES_MASSA = [
  {
    categoriaSlug: "memory-policies-gc",
    documentoCodigo: "HPHL-DOC-MEM-001",
    tag: "memory-arena-pool",
    titulos: [
      "Picos de latência no Garbage Collector ao instanciar objetos temporários no loop de simulação",
      "Dúvida sobre uso da política de memória arena versus pool em sistemas de partículas",
      "Exceção de memória 0xC0000374 ao compartilhar lista dinâmica entre threads sem lock",
      "Como reduzir pressão no Young Generation GC durante parsing de grandes arquivos JSON",
    ],
    descricoes: [
      "O profiler da IDE indica pausas frequentes no coletor geracional quando o subsistema cria milhares de instâncias por segundo no heap padrão.",
      "Precisamos garantir desalocação em lote O(1) ao final de cada frame sem acionar varredura de raízes do GC em tempo real.",
      "Em cenário de alta concorrência com tasks paralelas, notamos instabilidade no heap ao concatenar strings dentro do bloco parallel.",
    ],
    resolucoes: [
      "Aplicada a política de memória `arena` para variáveis de escopo de frame e `pool` para objetos recicláveis, reduzindo as pausas do GC em 94%.",
      "Isoladas as alocações concorrentes utilizando buffers nativos `mem_alloc` dentro das tasks conforme documento HPHL-DOC-MEM-001.",
    ],
    codigo: "arena Transform[512] frameTransforms;\npool Projectile proj = new Projectile();",
  },
  {
    categoriaSlug: "vulkan-graphics-pipeline",
    documentoCodigo: "HPHL-DOC-VK-002",
    tag: "vulkan-validation",
    titulos: [
      "Aviso de sincronização na camada VK_LAYER_KHRONOS_validation ao destruir contexto Vulkan",
      "Corrupção visual em attachment de cor após segundo subpass no pipeline de pós-processamento",
      "Falha na leitura de buffer offscreen por layout incorreto em vkCmdCopyImageToBuffer",
      "Configuração de despacho indireto vkCmdDispatchIndirect para reflexos híbridos por tile",
    ],
    descricoes: [
      "Ao encerrar a janela de renderização com HPHL_VK_VALIDATION=1 ativo, a camada de validação reporta objeto filho VkDebugUtilsMessengerEXT ainda alocado.",
      "A imagem capturada no readback apresenta artefatos periódicos em blocos de 8x8 pixels quando o render pass intermediário finaliza.",
    ],
    resolucoes: [
      "Adicionada chamada a `vk_debug_detach(instance)` antes de `vkDestroyInstance` e configurado `storeOp = STORE` nos descritores de attachment.",
      "Ajustado `srcImageLayout` para `TRANSFER_SRC_OPTIMAL` (6) e `bufferImageHeight = 0` no comando de cópia para buffer.",
    ],
    codigo: "vk_debug_detach(this.instance);\nvkDestroyInstance(this.instance, null);",
  },
  {
    categoriaSlug: "networking-async-sockets",
    documentoCodigo: "HPHL-DOC-NET-003",
    tag: "tcp-socket-timeout",
    titulos: [
      "Timeout na comunicação socket TCP ao consultar endpoint HTTP de telemetria",
      "Como configurar tempo limite de leitura (SO_RCVTIMEO) em conexões TcpSocket",
      "Descoberta de gateway padrão IPv4 via net.Route para mapeamento de porta NAT-PMP/PCP",
      "Uso de AcceptAsync com IOCP no Windows para servidor de pacotes de alta vazão",
    ],
    descricoes: [
      "Clientes em redes instáveis ficavam aguardando resposta de pacotes TCP por tempo indeterminado quando o host remoto sofria queda silenciosa.",
      "Necessário definir limite estrito de 3000ms tanto no handshake inicial quanto na recepção de chunks com ReadAll.",
    ],
    resolucoes: [
      "Substituída a conexão padrão por `sock.ConnectTimeout(host, port, 3000)` e aplicado `sock.SetTimeout(3000)` conforme guia HPHL-DOC-NET-003.",
    ],
    codigo: "TcpSocket s = new TcpSocket();\ns.ConnectTimeout(\"10.0.0.15\", 8080, 2500);",
  },
  {
    categoriaSlug: "compiler-codegen-x64-llvm",
    documentoCodigo: "HPHL-DOC-CG-004",
    tag: "llvm-x64-codegen",
    titulos: [
      "Diferença de resultado em operações bitwise sobre inteiros sem sinal u16 e u32",
      "Dúvida sobre uso de constantes nomeadas de módulo em blocos de pattern matching (match)",
      "Erro de validação de tipo LLVM IR ao passar expressão lógica para método ou construtor",
      "Como inspecionar o assembly x86_64 gerado lado a lado usando o Disassembly Viewer da IDE",
    ],
    descricoes: [
      "Uma constante simbólica declarada no módulo estava sendo interpretada como variável de captura no primeiro braço do bloco match.",
      "Operações de deslocamento à esquerda em u32 precisavam de máscara explícita antes da atualização do compilador para v1.4.0-dev.",
    ],
    resolucoes: [
      "Atualizado o compilador para a build 1.4.0-dev onde constantes compile-time são resolvidas no analisador semântico e tipos unsigned sofrem zero-extend automático.",
    ],
    codigo: "match (estado) {\n    STATUS_OK => { print(\" Sucesso\\n\"); }\n    _ => { print(\"Falha\\n\"); }\n}",
  },
  {
    categoriaSlug: "tensor-embeddings-rag",
    documentoCodigo: "HPHL-DOC-AI-005",
    tag: "pgvector-rag-1536d",
    titulos: [
      "Integração de vetores de 1536 dimensões no PostgreSQL com extensão pgvector para Helpdesk",
      "Aceleração de multiplicação de matrizes float64 com hphl_tensor_matmul_f64 em CPU multicore",
      "Calibração de limiar de similaridade de cosseno para recuperação de chamados históricos",
      "Tokenização de código-fonte e logs de erro usando o pacote llm.Tokenizer da HP-HL",
    ],
    descricoes: [
      "Buscamos recuperar chamados antigos que resolvam problemas equivalentes mesmo quando o usuário utiliza sinônimos na descrição do incidente.",
      "Necessário indexar 5.000 chamados com vetores de 1536 dimensões mantendo tempo de consulta abaixo de 20 milissegundos.",
    ],
    resolucoes: [
      "Implementado fluxo RAG sobre PostgreSQL 16 + pgvector com índice HNSW (`vector_cosine_ops`) e geração de embeddings normalizados L2.",
    ],
    codigo: "list<int> tokens = new list<int>();\nSimpleEncode(textoConsulta, tokens);",
  },
  {
    categoriaSlug: "ffi-native-interop",
    documentoCodigo: "HPHL-DOC-FFI-006",
    tag: "ffi-binary-ptr",
    titulos: [
      "Carregamento de buffer binário glTF com bytes zero intermediários via read_bytes",
      "Mapeamento de structs C com ponteiro opaco ptr e leitura de offsets via mem_peek_u32",
      "Cálculo de checksum FNV-1a 64 bits de imagens PNG usando a builtin file_hash",
      "Vinculação dinâmica de biblioteca C externa com diretiva extern no arquivo .hpproj",
    ],
    descricoes: [
      "Ao ler arquivos binários que possuem bytes 0x00 logo no cabeçalho, a função de leitura textual retornava string incompleta.",
      "Necessário alocar bloco contíguo na memória nativa, preencher campos alinhados em bytes e passar o endereço via FFI para DLL externa.",
    ],
    resolucoes: [
      "Adotada a builtin `read_bytes(path, buf, cap)` combinada com `mem_alloc` e `mem_peek_u32`, garantindo leitura binária exata sem truncamento NUL.",
    ],
    codigo: "ptr header = mem_alloc(64);\nint n = read_bytes(\"asset.glb\", header, 64);\nmem_free(header);",
  },
  {
    categoriaSlug: "autenticacao-credenciais-acesso",
    documentoCodigo: "HPHL-DOC-SEC-007",
    tag: "auth-password-reset",
    titulos: [
      "Solicitação de redefinição de senha esquecida para acesso ao portal Smart-Base",
      "Como recuperar acesso à conta corporativa após bloqueio por tentativas de login",
      "Rotação de token de autenticação expirado no gerenciador de pacotes hphl fetch",
      "Liberação de permissão de publicação para novo engenheiro no repositório interno",
    ],
    descricoes: [
      "O colaborador informou que esqueceu a senha de autenticação e não consegue acessar o ambiente de publicação de pacotes nem abrir chamados autenticados.",
      "Após trocar de estação de trabalho, o token salvo expirou e o usuário precisa redefinir suas credenciais de acesso imediatamente.",
    ],
    resolucoes: [
      "Executado fluxo de recuperação de acesso conforme HPHL-DOC-SEC-007: credenciais redefinidas via SSO e novo token de sessão sincronizado.",
    ],
    codigo: "// Comando de recuperacao executado:\n// hphl auth recover --email dev@smartbase.io",
  },
];

const AMBIENTES_DETALHE = [
  "Windows 11 Pro x64 (Build 26100) — Backend nativo x86_64",
  "Windows 11 Enterprise x64 — Backend LLVM 18 (-O3)",
  "Ubuntu 24.04 LTS (Kernel 6.8, io_uring ativo) — Container Docker",
  "Debian 12 Bookworm — Servidor CI/CD GitHub Actions",
  "Windows Server 2022 — Nó de Processamento Tensor AVX2",
  "macOS Sonoma (Apple Silicon / Rosetta x64) — Ambiente de Homologação",
];

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
const STATUS_LIST = ["RESOLVIDO", "RESOLVIDO", "RESOLVIDO", "FECHADO", "EM_ANALISE", "ABERTO"];

module.exports = {
  CATEGORIAS_BASE,
  USUARIOS_BASE,
  TAGS_BASE,
  DOCUMENTOS_BASE,
  CHAMADOS_CANONICOS,
  TEMPLATES_MASSA,
  AMBIENTES_DETALHE,
  PRIORIDADES,
  STATUS_LIST,
};
