const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.documentType.count();
    const withCode = await prisma.documentType.count({
      where: { code: { not: null } },
    });
    const sample = await prisma.documentType.findMany({
      take: 15,
      select: { code: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    });
    console.log({ total, withCode, nullCodes: total - withCode });
    console.log(sample);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
