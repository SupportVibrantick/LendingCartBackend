/**
 * Standalone entry point for broker application product fields.
 * Field definitions live in applicationBuilder.seed.js — this script reuses that seed.
 */
const prisma = require("../client");
const { seedApplicationBuilder } = require("./applicationBuilder.seed");

async function main() {
  console.log("🌱 Seeding product fields (via application builder)...");
  await seedApplicationBuilder();
  console.log("✅ Product field seeding completed");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Product fields seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
