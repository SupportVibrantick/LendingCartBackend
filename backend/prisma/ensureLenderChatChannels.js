const prisma = require("./client");

let channelsReadyPromise = null;

/**
 * Allows one PRINCIPAL_BROKER and one LOAN_OFFICER thread per applicationLender.
 * Safe to run multiple times (migration may already have created the unique index).
 */
async function runEnsureLenderChatChannels() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Conversation"
    SET "chatCategory" = 'PRINCIPAL_BROKER'
    WHERE "applicationLenderId" IS NOT NULL
      AND "type" = 'BROKER_LENDER'
      AND ("chatCategory" IS NULL OR "chatCategory" = '')
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Conversation"
    DROP CONSTRAINT IF EXISTS "Conversation_applicationLenderId_key"
  `);

  await prisma.$executeRawUnsafe(`
    DROP INDEX IF EXISTS "Conversation_applicationLenderId_key"
  `);

  // Migration creates this as a UNIQUE INDEX; ADD CONSTRAINT fails if the index exists.
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_applicationLenderId_chatCategory_key"
    ON "Conversation" ("applicationLenderId", "chatCategory")
  `);
}

async function ensureLenderChatChannels() {
  if (!channelsReadyPromise) {
    channelsReadyPromise = runEnsureLenderChatChannels().catch((error) => {
      channelsReadyPromise = null;
      throw error;
    });
  }

  return channelsReadyPromise;
}

module.exports = { ensureLenderChatChannels };

if (require.main === module) {
  ensureLenderChatChannels()
    .then(() => {
      console.log("✅ Lender chat channel constraints are ready");
    })
    .catch((error) => {
      console.error("❌ Failed to prepare lender chat channels:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
