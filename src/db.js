// ============================================================================
// src/db.js
// Camada de Conexão Relacional (Prisma ORM - Trilha A) e Vetorial (pg - Trilha C)
// ============================================================================

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

let PrismaClientClass = null;
try {
  PrismaClientClass = require("@prisma/client").PrismaClient;
} catch (_) {
  PrismaClientClass = null;
}

const SNAPSHOT_PATH = path.resolve(__dirname, "../data/smartbase_local_store.json");

let prismaInstance = null;
let pgPoolInstance = null;

function getPrisma() {
  if (! prismaInstance && PrismaClientClass) {
    prismaInstance = new PrismaClientClass();
  }
  return prismaInstance;
}

function getPgPool() {
  if (!pgPoolInstance) {
    pgPoolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2500,
    });
  }
  return pgPoolInstance;
}

/**
 * Testa se o contêiner PostgreSQL 16 (Docker) está acessível na porta configurada
 */
async function checkPostgresConnection() {
  const pool = getPgPool();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1;");
      return { connected: true };
    } finally {
      client.release();
    }
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

async function closeConnections() {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
    } catch (_) {}
    prismaInstance = null;
  }
  if (pgPoolInstance) {
    try {
      await pgPoolInstance.end();
    } catch (_) {}
    pgPoolInstance = null;
  }
}

function saveLocalStore(storeData) {
  const dir = path.dirname(SNAPSHOT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(storeData), "utf8");
}

function loadLocalStore() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
}

module.exports = {
  getPrisma,
  getPgPool,
  checkPostgresConnection,
  closeConnections,
  saveLocalStore,
  loadLocalStore,
  SNAPSHOT_PATH,
};
