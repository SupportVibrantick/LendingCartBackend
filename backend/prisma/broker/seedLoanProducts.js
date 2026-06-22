/**
 * Standalone script: attach catalog loan products to the active broker application.
 * Run after admin loan product seed: node prisma/broker/seedLoanProducts.js
 */
const prisma = require("../client");
const { BROKER_ORG_NAME } = require("../seedConfig");
const { LOAN_PRODUCTS } = require("../loanProductCatalog");

async function seedBrokerApplicationLoanProducts() {
  console.log("\n🌱 Seeding broker application loan products...\n");

  const brokerOrg = await prisma.organization.findFirst({
    where: {
      type: "BROKER",
      name: BROKER_ORG_NAME,
    },
  });

  if (!brokerOrg) {
    throw new Error(`Broker organization not found: ${BROKER_ORG_NAME}`);
  }

  let application = await prisma.brokerApplication.findFirst({
    where: {
      brokerOrgId: brokerOrg.id,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!application) {
    application = await prisma.brokerApplication.findFirst({
      where: { brokerOrgId: brokerOrg.id },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!application) {
    throw new Error(
      "No broker application found. Run applicationBuilder seed first.",
    );
  }

  for (const product of LOAN_PRODUCTS) {
    const catalogRow = await prisma.loanProduct.findFirst({
      where: { code: product.code },
    });

    if (!catalogRow) {
      console.warn(`⚠️ Skipping ${product.code}: not in loan_products table`);
      continue;
    }

    const existing = await prisma.brokerApplicationProduct.findFirst({
      where: {
        brokerApplicationId: application.id,
        loanProductCode: product.code,
      },
    });

    if (existing) {
      console.log(`ℹ️ Already exists: ${product.name}`);
      continue;
    }

    await prisma.brokerApplicationProduct.create({
      data: {
        brokerApplicationId: application.id,
        loanProductCode: product.code,
        isActive: true,
      },
    });

    console.log(`✅ Created: ${product.name}`);
  }

  console.log("\n🎉 Broker application loan products seeded.\n");
}

if (require.main === module) {
  seedBrokerApplicationLoanProducts()
    .catch((e) => {
      console.error("❌ seedLoanProducts failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedBrokerApplicationLoanProducts };
