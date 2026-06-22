/**
 * Production-safe database deploy:
 * 1. Baseline init migration on existing databases (brownfield)
 * 2. Apply pending Prisma migrations
 * 3. Apply idempotent schema patches
 *
 * Usage: node prisma/deployDatabase.js
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const INIT_MIGRATION = "20250618120000_init";
const BACKEND_ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function migrationsDirExists() {
  return fs.existsSync(MIGRATIONS_DIR);
}

function getMigrationFolderNames() {
  if (!migrationsDirExists()) {
    console.warn(
      "⚠️ No prisma/migrations directory found — skipping Prisma migrate deploy.",
    );
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(MIGRATIONS_DIR, entry.name, "migration.sql")),
    )
    .map((entry) => entry.name);
}

function run(command) {
  console.log(`> ${command}`);
  execSync(command, {
    stdio: "inherit",
    cwd: BACKEND_ROOT,
    env: process.env,
  });
}

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;

  return Boolean(rows[0]?.exists);
}

async function migrationApplied(prisma, migrationName) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM "_prisma_migrations"
      WHERE migration_name = ${migrationName}
    `;

    return (rows[0]?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function reconcileMigrationHistory(prisma) {
  const validNames = new Set(getMigrationFolderNames());

  try {
    const applied = await prisma.$queryRaw`
      SELECT migration_name AS name
      FROM "_prisma_migrations"
    `;

    for (const row of applied) {
      if (!validNames.has(row.name)) {
        console.log(
          `🧹 Removing stale migration record: ${row.name}`,
        );
        await prisma.$executeRaw`
          DELETE FROM "_prisma_migrations"
          WHERE migration_name = ${row.name}
        `;
      }
    }
  } catch {
    // _prisma_migrations does not exist yet (fresh database).
  }
}

async function main() {
  const prisma = new PrismaClient();

  try {
    await reconcileMigrationHistory(prisma);

    const hasCoreTables = await tableExists(prisma, "organizations");
    const initApplied = await migrationApplied(prisma, INIT_MIGRATION);

    const migrationNames = getMigrationFolderNames();

    if (
      migrationNames.length > 0 &&
      hasCoreTables &&
      !initApplied &&
      migrationNames.includes(INIT_MIGRATION)
    ) {
      console.log(
        `📌 Existing database detected — marking ${INIT_MIGRATION} as applied (baseline)...`,
      );
      run(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`);
    }

    if (migrationNames.length > 0) {
      console.log("🗄️ Applying pending migrations...");
      run("npx prisma migrate deploy");
    } else {
      console.log("⏭️ No migration files to deploy");
    }

    const { applySchemaPatches } = require("./applySchemaPatches");
    await applySchemaPatches(prisma);

    console.log("✅ Database deploy completed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌ Database deploy failed:", error.message || error);
  process.exit(1);
});
