const { randomUUID } = require("crypto");
const {
  decimalToNumber,
  roundMoney,
  derivePayoutStatus,
} = require("../../utils/commission/commissionHelpers");
const { logCommissionAuditEvent } = require("./auditCommissionEvent");

const payoutInclude = {
  dealCommission: {
    include: {
      recipientUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      loanApplication: {
        select: {
          applicationNumber: true,
          fundedAt: true,
          client: { select: { legalName: true } },
        },
      },
    },
  },
  commissionInvoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
    },
  },
  paidByUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
};

const ALLOWED_PAYMENT_METHODS = new Set([
  "ACH",
  "WIRE",
  "CHECK",
  "CASH",
  "MANUAL",
  "STRIPE",
]);

/**
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function recordCommissionPayout(
  db,
  {
    dealCommissionId,
    brokerOrgId,
    paidByUserId,
    paymentMethod = "MANUAL",
    paymentReference = null,
    notes = null,
    commissionInvoiceId = null,
    amount = null,
  },
) {
  const normalizedMethod = String(paymentMethod || "MANUAL").toUpperCase();
  if (!ALLOWED_PAYMENT_METHODS.has(normalizedMethod)) {
    throw new Error("Invalid payment method");
  }

  const commission = await db.dealCommission.findFirst({
    where: {
      id: dealCommissionId,
      brokerOrgId,
      status: "CALCULATED",
    },
    include: {
      payouts: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
    },
  });

  if (!commission) {
    throw new Error("Commission record not found");
  }

  const commissionAmount = decimalToNumber(commission.commissionAmount) || 0;
  const alreadyPaid = commission.payouts.reduce(
    (sum, payout) => sum + (decimalToNumber(payout.amount) || 0),
    0,
  );

  if (alreadyPaid >= commissionAmount && commissionAmount > 0) {
    throw new Error("Commission is already fully paid");
  }

  const payoutAmount = roundMoney(
    amount != null ? Number(amount) : commissionAmount - alreadyPaid,
  );

  if (payoutAmount <= 0) {
    throw new Error("Payout amount must be greater than zero");
  }

  if (roundMoney(alreadyPaid + payoutAmount) > commissionAmount) {
    throw new Error("Payout amount exceeds remaining commission balance");
  }

  let invoiceId = commissionInvoiceId;
  if (!invoiceId) {
    const latestInvoice = await db.commissionInvoice.findFirst({
      where: {
        dealCommissionId,
        status: { not: "VOID" },
      },
      orderBy: { generatedAt: "desc" },
      select: { id: true },
    });
    invoiceId = latestInvoice?.id || null;
  }

  const payout = await db.commissionPayout.create({
    data: {
      id: randomUUID(),
      dealCommissionId,
      commissionInvoiceId: invoiceId,
      brokerOrgId,
      loanApplicationId: commission.loanApplicationId,
      amount: payoutAmount,
      paymentMethod: normalizedMethod,
      paymentReference: paymentReference || null,
      notes: notes || null,
      status: "COMPLETED",
      paidAt: new Date(),
      paidByUserId,
    },
    include: payoutInclude,
  });

  await logCommissionAuditEvent(db, {
    brokerOrgId,
    loanApplicationId: commission.loanApplicationId,
    dealCommissionId,
    commissionInvoiceId: invoiceId,
    commissionPayoutId: payout.id,
    eventType: "PAYOUT_RECORDED",
    actorUserId: paidByUserId,
    metadata: {
      amount: payoutAmount,
      paymentMethod: normalizedMethod,
      paymentReference: paymentReference || null,
      notes: notes || null,
    },
  });

  return payout;
}

module.exports = {
  recordCommissionPayout,
  derivePayoutStatus,
  payoutInclude,
  ALLOWED_PAYMENT_METHODS,
};
