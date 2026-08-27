/**
 * Repair: create missing broker admin for a paid Loan AI org and send welcome email.
 * Usage: node scripts/repairBrokerWelcomeEmail.js <loanAiEmail>
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const {
  ensureBrokerAdminAccess,
} = require("../services/broker/provisionBrokerFromLoanAi");
const { processEmailOutbox } = require("../services/email");

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/repairBrokerWelcomeEmail.js <loanAiEmail>");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const loanAiUser = await prisma.loanAiUser.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!loanAiUser?.brokerOrganizationId) {
      throw new Error("Loan AI user not found or has no broker organization");
    }

    const sub = await prisma.organizationSubscription.findFirst({
      where: { organizationId: loanAiUser.brokerOrganizationId },
      orderBy: { createdAt: "desc" },
      include: { package: { select: { name: true, code: true } } },
    });

    const result = await ensureBrokerAdminAccess(prisma, {
      organizationId: loanAiUser.brokerOrganizationId,
      loanAiUser,
      firstName: loanAiUser.firstName,
      lastName: loanAiUser.lastName,
      packageName: sub?.package?.name || sub?.package?.code || "Pro",
      sendWelcome: true,
      welcomeIdempotencyKey: `broker-welcome-repair:${email}:${Date.now()}`,
    });

    const processed = await processEmailOutbox(prisma);
    console.log(JSON.stringify({ result, processed }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
