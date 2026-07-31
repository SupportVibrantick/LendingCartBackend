const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const LENDER_ORG_ID = process.argv[2] || "3f4737fb-947a-41f2-bdc1-3bd825448520";

async function main() {
  const products = await prisma.lenderProduct.findMany({
    where: { lenderOrgId: LENDER_ORG_ID },
    select: {
      id: true,
      loanProductCode: true,
      loanProduct: { select: { name: true } },
      minLoanAmount: true,
      maxLoanAmount: true,
      maxLtvPercent: true,
      maxLtcPercent: true,
      minRateSpreadPercent: true,
      maxRateSpreadPercent: true,
      interestRateRange: true,
      minCreditScore: true,
      maxFinancingPercent: true,
      updatedAt: true,
    },
    orderBy: { loanProductCode: "asc" },
  });

  const formatted = products.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value) && "loanProductCode" in value === false && "name" in value) {
          return [key, value];
        }
        if (value && typeof value.toString === "function" && value.constructor?.name === "Decimal") {
          return [key, value.toString()];
        }
        return [key, value];
      }),
    ),
  );

  console.log(`Lender org: ${LENDER_ORG_ID}`);
  console.log(JSON.stringify(formatted, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
