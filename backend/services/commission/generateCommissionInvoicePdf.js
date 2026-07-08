const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { decimalToNumber } = require("../../utils/commission/commissionHelpers");

function formatCurrency(value) {
  const numeric = decimalToNumber(value) || 0;
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatPerson(user) {
  if (!user) return "—";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "—";
}

function generateCommissionInvoicePdf({
  brokerOrg,
  recipientUser,
  applicationNumber,
  loanAmount,
  brokerPoints,
  findersFeePercent,
  commissionAmount,
  invoiceNumber,
  invoiceDate,
  paymentInstructions,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      doc.fontSize(22).font("Helvetica-Bold").text("Commission Invoice", {
        align: "center",
      });
      doc.moveDown(0.25);
      doc.fontSize(11).font("Helvetica").fillColor("#555555").text(invoiceNumber, {
        align: "center",
      });
      doc.fillColor("#000000");
      doc.moveDown(1.5);

      const leftX = 50;
      const rightX = 320;
      let y = doc.y;

      doc.font("Helvetica-Bold").fontSize(11).text("Broker", leftX, y);
      doc.font("Helvetica").text(brokerOrg?.name || "Broker", leftX, y + 16);

      doc.font("Helvetica-Bold").text("Recipient", rightX, y);
      doc.font("Helvetica").text(formatPerson(recipientUser), rightX, y + 16);

      y += 52;
      doc.font("Helvetica-Bold").text("Deal Number", leftX, y);
      doc.font("Helvetica").text(applicationNumber || "—", leftX, y + 16);

      doc.font("Helvetica-Bold").text("Invoice Date", rightX, y);
      doc.font("Helvetica").text(
        invoiceDate ? new Date(invoiceDate).toLocaleDateString() : "—",
        rightX,
        y + 16,
      );

      y += 52;
      doc.font("Helvetica-Bold").text("Loan Amount", leftX, y);
      doc.font("Helvetica").text(formatCurrency(loanAmount), leftX, y + 16);

      doc.font("Helvetica-Bold").text("Broker Points", rightX, y);
      doc.font("Helvetica").text(
        brokerPoints != null ? `${decimalToNumber(brokerPoints)}%` : "—",
        rightX,
        y + 16,
      );

      y += 52;
      doc.font("Helvetica-Bold").text("Commission %", leftX, y);
      doc.font("Helvetica").text(
        findersFeePercent != null ? `${decimalToNumber(findersFeePercent)}%` : "—",
        leftX,
        y + 16,
      );

      doc.font("Helvetica-Bold").text("Commission Amount", rightX, y);
      doc.font("Helvetica-Bold").fontSize(14).text(
        formatCurrency(commissionAmount),
        rightX,
        y + 14,
      );

      doc.moveDown(4);
      doc.font("Helvetica-Bold").fontSize(12).text("Payment Instructions");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(10).text(
        paymentInstructions ||
          "Please contact your broker administrator for payment instructions.",
        { align: "left" },
      );

      doc.moveDown(2);
      doc.fontSize(9).fillColor("#666666").text(
        "This invoice documents earned commission. Payment is recorded separately by the broker.",
        { align: "center" },
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function ensureInvoiceStorageDir() {
  const uploadDir = path.join(process.cwd(), "public/broker/commission-invoices");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

function saveCommissionInvoicePdf(buffer, invoiceNumber) {
  const uploadDir = ensureInvoiceStorageDir();
  const safeName = String(invoiceNumber || "invoice")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 80);
  const fileName = `${safeName}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/public/broker/commission-invoices/${fileName}`;
}

module.exports = {
  generateCommissionInvoicePdf,
  saveCommissionInvoicePdf,
  formatCurrency,
};
