const prisma = require("./client");

/**
 * Allows one PRINCIPAL_BROKER and one LOAN_OFFICER thread per applicationLender.
 * Safe to run multiple times.
 */
async function ensureLenderChatChannels() {
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

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Conversation_applicationLenderId_chatCategory_key'
      ) THEN
        ALTER TABLE "Conversation"
        ADD CONSTRAINT "Conversation_applicationLenderId_chatCategory_key"
        UNIQUE ("applicationLenderId", "chatCategory");
      END IF;
    END $$;
  `);
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
