const prisma = require("../client");
const { seedLoanMessaging } = require("./loanMessaging.seed");

async function main() {
  const app = await prisma.loanApplication.findFirst({
    where: { applicationNumber: "APP-SEED-FIX-FLIP-001" },
  });

  if (!app) {
    console.log("No seeded application found");
    return;
  }

  const officer = await prisma.userAccount.findFirst({
    where: { email: "sarah.mitchell@demo-broker.com" },
  });

  if (officer) {
    await prisma.loanApplication.update({
      where: { id: app.id },
      data: { brokerUserId: officer.id },
    });
    console.log("Assigned application to Sarah Mitchell");
  }

  await seedLoanMessaging(app.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
