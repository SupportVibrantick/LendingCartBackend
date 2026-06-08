const prisma = require("../client");

async function ensureConversationTypes() {
  const values = ["BROKER_OFFICER", "CLIENT_OFFICER"];

  for (const value of values) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS '${value}'`,
      );
      console.log(`✅ ConversationType enum includes ${value}`);
    } catch (error) {
      if (String(error.message).includes("already exists")) {
        console.log(`ℹ️ ConversationType enum already includes ${value}`);
        continue;
      }
      throw error;
    }
  }
}

module.exports = { ensureConversationTypes };

if (require.main === module) {
  ensureConversationTypes()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
