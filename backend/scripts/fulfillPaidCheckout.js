/**
 * One-shot: fulfill a paid GHL checkout locally when webhooks never arrived.
 * Usage: node scripts/fulfillPaidCheckout.js <checkoutId>
 */
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const {
  syncPaidCheckoutFromGhl,
} = require("../services/ghl/syncPaidCheckoutFromGhl.service");

async function main() {
  const checkoutId = process.argv[2];
  if (!checkoutId) {
    console.error("Usage: node scripts/fulfillPaidCheckout.js <checkoutId>");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const checkout = await prisma.loanAiGhlCheckout.findUnique({
      where: { id: checkoutId },
      include: { loanAiUser: true },
    });
    if (!checkout?.loanAiUser) {
      throw new Error("Checkout or Loan AI user not found");
    }

    const result = await syncPaidCheckoutFromGhl(
      prisma,
      null,
      checkout.loanAiUser,
      { checkoutId },
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
