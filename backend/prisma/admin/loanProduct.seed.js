const prisma = require("../client");
const { LOAN_PRODUCTS } = require("../loanProductCatalog");

/** Active catalog codes from loanProductCatalog (includes SBA Express). */
const ALLOWED_CODES = LOAN_PRODUCTS.map((product) => product.code);

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
          description: "",
          isActive: true,
        },
      });

      console.log(`✅ Created loan product: ${product.name}`);
      continue;
    }

    const normalizedDescription = existing.description ?? "";
    const needsUpdate =
      existing.name !== product.name ||
      normalizedDescription !== "" ||
      existing.isActive !== true;

    if (needsUpdate) {
      await prisma.loanProduct.update({
        where: { id: existing.id },
        data: {
          name: product.name,
          description: "",
          isActive: true,
        },
      });

      console.log(`✅ Updated loan product: ${product.name}`);
    } else {
      console.log(`ℹ️ Loan product already exists: ${product.name}`);
    }
  }

  const deactivated = await prisma.loanProduct.updateMany({
    where: {
      code: {
        notIn: ALLOWED_CODES,
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  if (deactivated.count > 0) {
    console.log(`ℹ️ Deactivated ${deactivated.count} non-catalog loan product(s)`);
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
