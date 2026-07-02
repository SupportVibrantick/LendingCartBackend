const { randomUUID } = require("crypto");
const path = require("path");
const fs = require("fs");
const { logCommissionAuditEvent } = require("./auditCommissionEvent");
const {
  generateCommissionInvoicePdf,
  saveCommissionInvoicePdf,
} = require("./generateCommissionInvoicePdf");

async function generateSequentialInvoiceNumber(db, brokerOrgId) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const last = await db.commissionInvoice.findFirst({
    where: {
      brokerOrgId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let sequence = 1;
  if (last?.invoiceNumber) {
    const parts = last.invoiceNumber.split("-");
    const numeric = Number(parts[parts.length - 1]);
    if (Number.isFinite(numeric)) {
      sequence = numeric + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(5, "0")}`;
}

function buildDefaultPaymentInstructions(brokerOrg) {
  const lines = [
    brokerOrg?.name ? `Pay to: ${brokerOrg.name}` : null,
    brokerOrg?.email ? `Email: ${brokerOrg.email}` : null,
    brokerOrg?.phone ? `Phone: ${brokerOrg.phone}` : null,
    "ACH / Wire / Check payments accepted. Include invoice number in payment reference.",
  ].filter(Boolean);

  return lines.join("\n");
}

const commissionIncludeForInvoice = {
  recipientUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  loanApplication: {
    select: {
      id: true,
      applicationNumber: true,
      brokerOrgId: true,
    },
  },
  brokerOrg: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
};

/**
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function generateCommissionInvoice(
  db,
  {
    dealCommissionId,
    brokerOrgId,
    generatedByUserId = null,
    paymentInstructions = null,
  },
) {
  const commission = await db.dealCommission.findFirst({
    where: {
      id: dealCommissionId,
      brokerOrgId,
      status: "CALCULATED",
    },
    include: commissionIncludeForInvoice,
  });

  if (!commission) {
    throw new Error("Commission record not found");
  }

  if (commission.recipientRole === "BROKER") {
    throw new Error("Broker retained commission does not require an invoice");
  }

  const invoiceNumber = await generateSequentialInvoiceNumber(db, brokerOrgId);
  const instructions =
    paymentInstructions ||
    buildDefaultPaymentInstructions(commission.brokerOrg);

  const pdfBuffer = await generateCommissionInvoicePdf({
    brokerOrg: commission.brokerOrg,
    recipientUser: commission.recipientUser,
    applicationNumber: commission.loanApplication?.applicationNumber,
    loanAmount: commission.loanAmount,
    brokerPoints: commission.brokerPoints,
    findersFeePercent: commission.findersFeePercent,
    commissionAmount: commission.commissionAmount,
    invoiceNumber,
    invoiceDate: new Date(),
    paymentInstructions: instructions,
  });

  const pdfUrl = saveCommissionInvoicePdf(pdfBuffer, invoiceNumber);

  const invoice = await db.commissionInvoice.create({
    data: {
      id: randomUUID(),
      dealCommissionId: commission.id,
      brokerOrgId,
      loanApplicationId: commission.loanApplicationId,
      invoiceNumber,
      status: "GENERATED",
      pdfUrl,
      paymentInstructions: instructions,
      generatedByUserId,
    },
    include: {
      dealCommission: {
        include: {
          recipientUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  await logCommissionAuditEvent(db, {
    brokerOrgId,
    loanApplicationId: commission.loanApplicationId,
    dealCommissionId: commission.id,
    commissionInvoiceId: invoice.id,
    eventType: "INVOICE_GENERATED",
    actorUserId: generatedByUserId,
    metadata: {
      invoiceNumber,
      amount: Number(commission.commissionAmount),
      recipientUserId: commission.recipientUserId,
    },
  });

  return invoice;
}

function resolveInvoicePdfPath(pdfUrl) {
  if (!pdfUrl) return null;
  const relativePath = pdfUrl.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), relativePath);
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Returns a local PDF path for an invoice, generating and persisting the file when missing.
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function ensureCommissionInvoicePdf(db, invoice) {
  const existingPath = resolveInvoicePdfPath(invoice.pdfUrl);
  if (existingPath) {
    return { filePath: existingPath, pdfUrl: invoice.pdfUrl };
  }

  const commission = await db.dealCommission.findFirst({
    where: { id: invoice.dealCommissionId },
    include: commissionIncludeForInvoice,
  });

  if (!commission) {
    throw new Error("Commission record not found");
  }

  const instructions =
    invoice.paymentInstructions ||
    buildDefaultPaymentInstructions(commission.brokerOrg);

  const pdfBuffer = await generateCommissionInvoicePdf({
    brokerOrg: commission.brokerOrg,
    recipientUser: commission.recipientUser,
    applicationNumber: commission.loanApplication?.applicationNumber,
    loanAmount: commission.loanAmount,
    brokerPoints: commission.brokerPoints,
    findersFeePercent: commission.findersFeePercent,
    commissionAmount: commission.commissionAmount,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.generatedAt || invoice.createdAt || new Date(),
    paymentInstructions: instructions,
  });

  const pdfUrl = saveCommissionInvoicePdf(pdfBuffer, invoice.invoiceNumber);
  const filePath = resolveInvoicePdfPath(pdfUrl);

  if (!filePath) {
    throw new Error("Failed to save invoice PDF");
  }

  await db.commissionInvoice.update({
    where: { id: invoice.id },
    data: {
      pdfUrl,
      ...(invoice.paymentInstructions ? {} : { paymentInstructions: instructions }),
    },
  });

  return { filePath, pdfUrl };
}

module.exports = {
  generateCommissionInvoice,
  ensureCommissionInvoicePdf,
  generateSequentialInvoiceNumber,
  buildDefaultPaymentInstructions,
};
