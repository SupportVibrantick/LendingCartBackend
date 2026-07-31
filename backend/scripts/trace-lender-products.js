const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const serialize = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && typeof value.toString === "function") {
    const str = value.toString();
    if (str && str !== "[object Object]") return str;
  }
  return value;
};

async function main() {
  const products = await prisma.lenderProduct.findMany({
    where: {
      loanProductCode: {
        in: [
          "SBA_7A_WORKING_CAPITAL",
          "USDA_BI",
          "SBA_7A_BUSINESS_ACQUISITION",
          "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
        ],
      },
    },
    select: {
      id: true,
      loanProductCode: true,
      lenderOrgId: true,
      loanProductId: true,
      loanProduct: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      minLoanAmount: true,
      maxLoanAmount: true,
      maxLtvPercent: true,
      maxLtcPercent: true,
      minRateSpreadPercent: true,
      maxRateSpreadPercent: true,
      interestRateRange: true,
      minCreditScore: true,
      originationPointsPercent: true,
      minExperience: true,
      maxFinancingPercent: true,
      maxUsdaGuaranteeAmount: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const formatted = products.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, serialize(value)]),
    ),
  );

  console.log(JSON.stringify(formatted, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
