const prisma = require("../config/prisma");

async function main() {
  const withNotes = await prisma.lenderProduct.findMany({
    where: { criteriaNotes: { not: null } },
    select: {
      id: true,
      loanProductCode: true,
      criteriaNotes: true,
    },
    take: 10,
  });

  const crePermanent = await prisma.lenderProduct.findMany({
    where: { loanProductCode: "CRE_PERMANENT_LOAN" },
    select: {
      id: true,
      criteriaNotes: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  console.log("Products with criteriaNotes:", JSON.stringify(withNotes, null, 2));
  console.log("CRE Permanent:", JSON.stringify(crePermanent, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
