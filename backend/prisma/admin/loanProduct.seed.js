const prisma = require("../client");
const { LOAN_PRODUCTS } = require("../loanProductCatalog");

async function seedLoanProducts() {
  for (const product of LOAN_PRODUCTS) {
    const existing = await prisma.loanProduct.findFirst({
      where: {
        code: product.code,
      },
    });

    if (!existing) {
      await prisma.loanProduct.create({
        data: {
          code: product.code,
          name: product.name,
          isActive: true,
        },
      });

      console.log(`✅ Created loan product: ${product.name}`);
    } else if (existing.name !== product.name) {
      await prisma.loanProduct.update({
        where: { id: existing.id },
        data: { name: product.name },
      });

      console.log(`✅ Updated loan product name: ${product.name}`);
    } else {
      console.log(`ℹ️ Loan product already exists: ${product.name}`);
    }
  }

  console.log("✅ Loan products seeded");
}

module.exports = {
  seedLoanProducts,
};

if (require.main === module) {
  seedLoanProducts()
    .catch((err) => {
      console.error("❌ Loan products seed failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
