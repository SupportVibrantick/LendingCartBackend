/**
 * One-time migration: copy messages from legacy CLIENT_OFFICER and
 * CO_BROKER:* CLIENT_BROKER threads into the principal CLIENT_BROKER thread.
 *
 * Usage:
 *   node scripts/migrateClientThreadsToPrincipal.js
 *   node scripts/migrateClientThreadsToPrincipal.js --dry-run
 *   node scripts/migrateClientThreadsToPrincipal.js --loan-id=<uuid>
 */

const prisma = require("../prisma/client");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const loanIdArg = args.find((arg) => arg.startsWith("--loan-id="));
const loanIdFilter = loanIdArg ? loanIdArg.split("=")[1] : null;

function isPrincipalClientBroker(conversation) {
  return (
    conversation.type === "CLIENT_BROKER" &&
    (!conversation.chatCategory ||
      conversation.chatCategory === "PRINCIPAL" ||
      conversation.chatCategory === "PRINCIPAL_BROKER")
  );
}

function isLegacyClientThread(conversation) {
  if (conversation.type === "CLIENT_OFFICER") return true;
  if (
    conversation.type === "CLIENT_BROKER" &&
    conversation.chatCategory &&
    String(conversation.chatCategory).startsWith("CO_BROKER:")
  ) {
    return true;
  }
  return false;
}

async function migrateLoan(loanApplicationId) {
  const conversations = await prisma.conversation.findMany({
    where: { loanApplicationId },
    select: {
      id: true,
      type: true,
      chatCategory: true,
    },
  });

  const principal = conversations.find(isPrincipalClientBroker);
  const legacy = conversations.filter(isLegacyClientThread);

  if (!principal || legacy.length === 0) {
    return { loanApplicationId, copied: 0, skipped: true };
  }

  let copied = 0;

  for (const source of legacy) {
    const messages = await prisma.message.findMany({
      where: { conversationId: source.id },
      orderBy: { createdAt: "asc" },
    });

    for (const message of messages) {
      const exists = await prisma.message.findFirst({
        where: {
          conversationId: principal.id,
          createdAt: message.createdAt,
          senderType: message.senderType,
          text: message.text,
          fileUrl: message.fileUrl,
        },
        select: { id: true },
      });

      if (exists) continue;

      if (!dryRun) {
        await prisma.message.create({
          data: {
            conversationId: principal.id,
            senderType: message.senderType,
            senderUserId: message.senderUserId,
            senderClientUserId: message.senderClientUserId,
            senderName: message.senderName,
            type: message.type,
            text: message.text,
            fileUrl: message.fileUrl,
            fileName: message.fileName,
            fileSize: message.fileSize,
            mimeType: message.mimeType,
            metadata: message.metadata,
            createdAt: message.createdAt,
          },
        });
      }

      copied += 1;
    }
  }

  if (!dryRun && copied > 0) {
    const latest = await prisma.message.findFirst({
      where: { conversationId: principal.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (latest?.createdAt) {
      await prisma.conversation.update({
        where: { id: principal.id },
        data: { lastMessageAt: latest.createdAt },
      });
    }
  }

  return { loanApplicationId, copied, skipped: false };
}

async function main() {
  const loanIds = loanIdFilter
    ? [loanIdFilter]
    : (
        await prisma.conversation.findMany({
          where: {
            OR: [
              { type: "CLIENT_OFFICER" },
              {
                type: "CLIENT_BROKER",
                chatCategory: { startsWith: "CO_BROKER:" },
              },
            ],
          },
          distinct: ["loanApplicationId"],
          select: { loanApplicationId: true },
        })
      )
        .map((row) => row.loanApplicationId)
        .filter(Boolean);

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Migrating ${loanIds.length} loan(s)...`,
  );

  let totalCopied = 0;

  for (const loanApplicationId of loanIds) {
    const result = await migrateLoan(loanApplicationId);
    if (!result.skipped) {
      console.log(`  ${loanApplicationId}: copied ${result.copied} message(s)`);
      totalCopied += result.copied;
    }
  }

  console.log(`Done. Total copied: ${totalCopied}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
