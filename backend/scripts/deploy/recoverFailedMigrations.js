// Mark incomplete/failed Prisma migrations as rolled back so migrate deploy
// can re-apply them (for example after a BOM syntax failure at byte 0).
require("dotenv").config();
const { spawnSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const failed = await prisma.$queryRawUnsafe(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
      ORDER BY started_at ASC
    `);

    if (!failed.length) {
      console.log("No failed migrations to recover");
      return;
    }

    for (const row of failed) {
      const name = row.migration_name;
      console.log(`Marking failed migration as rolled back: ${name}`);
      const result = spawnSync(
        "npx",
        ["prisma", "migrate", "resolve", "--rolled-back", name],
        { stdio: "inherit", shell: true },
      );
      if (result.status !== 0) {
        throw new Error(`Failed to resolve rolled-back migration: ${name}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
