const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { decimalToNumber } = require("../../utils/commission/commissionHelpers");

const COLORS = {
  navy: "#1e293b",
  slate: "#64748b",
  border: "#e2e8f0",
  panel: "#f8fafc",
  accent: "#0f3f6b",
  amountBg: "#eef4fb",
  amountBorder: "#c7d7ea",
  white: "#ffffff",
  black: "#0f172a",
};

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

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function sanitizePaymentInstructions(text) {
  if (!text) return text;
  return String(text)
    .replace(/\s*\/\s*Zelle/gi, "")
    .replace(/\s*Zelle\s*\/\s*/gi, "")
    .replace(/\bZelle\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function drawRoundedRect(doc, x, y, w, h, r = 6) {
  doc.roundedRect(x, y, w, h, r);
}

function parseInstructionLines(paymentInstructions) {
  const raw = sanitizePaymentInstructions(
    paymentInstructions ||
      "Please contact your broker administrator for payment instructions.",
  );
  return String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
      const margin = 48;
      const doc = new PDFDocument({ size: "LETTER", margin });
      const buffers = [];
      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - margin * 2;

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // —— Header bar ——
      doc.save();
      doc.rect(0, 0, pageWidth, 92).fill(COLORS.accent);
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(COLORS.white)
        .text("Commission Invoice", margin, 28, {
          width: contentWidth * 0.58,
        });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#cbd5e1")
        .text("Loan Automation", margin, 56, {
          width: contentWidth * 0.58,
        });

      const metaX = margin + contentWidth * 0.55;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#94a3b8")
        .text("INVOICE NUMBER", metaX, 28, {
          width: contentWidth * 0.45,
          align: "right",
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.white)
        .text(invoiceNumber || "—", metaX, 42, {
          width: contentWidth * 0.45,
          align: "right",
        });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text(formatDate(invoiceDate), metaX, 60, {
          width: contentWidth * 0.45,
          align: "right",
        });
      doc.restore();

      let y = 116;

      // —— From / Bill to ——
      const colGap = 16;
      const colWidth = (contentWidth - colGap) / 2;
      const leftX = margin;
      const rightX = margin + colWidth + colGap;

      drawRoundedRect(doc, leftX, y, colWidth, 72, 8);
      doc.fillAndStroke(COLORS.panel, COLORS.border);
      drawRoundedRect(doc, rightX, y, colWidth, 72, 8);
      doc.fillAndStroke(COLORS.panel, COLORS.border);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.slate)
        .text("FROM", leftX + 14, y + 14);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.black)
        .text(brokerOrg?.name || "Broker", leftX + 14, y + 30, {
          width: colWidth - 28,
        });
      if (brokerOrg?.email) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.slate)
          .text(brokerOrg.email, leftX + 14, y + 48, {
            width: colWidth - 28,
          });
      }

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.slate)
        .text("BILL TO", rightX + 14, y + 14);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.black)
        .text(formatPerson(recipientUser), rightX + 14, y + 30, {
          width: colWidth - 28,
        });
      if (recipientUser?.email) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.slate)
          .text(recipientUser.email, rightX + 14, y + 48, {
            width: colWidth - 28,
          });
      }

      y += 92;

      // —— Deal summary table ——
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.navy)
        .text("Deal summary", leftX, y);
      y += 18;

      const rows = [
        ["Deal number", applicationNumber || "—"],
        ["Loan amount", formatCurrency(loanAmount)],
        [
          "Broker points",
          brokerPoints != null ? `${decimalToNumber(brokerPoints)}%` : "—",
        ],
        [
          "Commission %",
          findersFeePercent != null
            ? `${decimalToNumber(findersFeePercent)}%`
            : "—",
        ],
      ];

      const tableTop = y;
      const rowH = 28;
      const labelColW = contentWidth * 0.42;
      const tableH = rows.length * rowH;

      drawRoundedRect(doc, leftX, tableTop, contentWidth, tableH, 8);
      doc.fillAndStroke(COLORS.white, COLORS.border);

      rows.forEach(([label, value], index) => {
        const rowY = tableTop + index * rowH;
        if (index % 2 === 1) {
          doc
            .rect(leftX + 1, rowY, contentWidth - 2, rowH)
            .fill(COLORS.panel);
        }
        if (index > 0) {
          doc
            .moveTo(leftX + 12, rowY)
            .lineTo(leftX + contentWidth - 12, rowY)
            .strokeColor(COLORS.border)
            .lineWidth(0.6)
            .stroke();
        }
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(COLORS.slate)
          .text(label, leftX + 16, rowY + 9, { width: labelColW - 20 });
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(COLORS.black)
          .text(value, leftX + labelColW, rowY + 9, {
            width: contentWidth - labelColW - 20,
            align: "right",
          });
      });

      y = tableTop + tableH + 20;

      // —— Amount due ——
      drawRoundedRect(doc, leftX, y, contentWidth, 64, 10);
      doc.fillAndStroke(COLORS.amountBg, COLORS.amountBorder);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.slate)
        .text("AMOUNT DUE", leftX + 20, y + 16);
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor(COLORS.accent)
        .text(formatCurrency(commissionAmount), leftX + 20, y + 30, {
          width: contentWidth - 40,
        });

      y += 84;

      // —— Payment instructions ——
      const instructionLines = parseInstructionLines(paymentInstructions);
      const pairLines = [];
      const noteLines = [];

      for (const line of instructionLines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          pairLines.push([match[1].trim(), match[2].trim()]);
        } else {
          noteLines.push(line);
        }
      }

      doc.font("Helvetica").fontSize(9);
      const pairsH = Math.max(pairLines.length, 0) * 22;
      const notesH = noteLines.reduce((sum, line) => {
        const h = doc.heightOfString(line, { width: contentWidth - 32 });
        return sum + h + 6;
      }, noteLines.length ? 8 : 0);
      const emptyH = pairLines.length === 0 && noteLines.length === 0 ? 28 : 0;
      const panelH = 36 + pairsH + notesH + emptyH + 16;

      drawRoundedRect(doc, leftX, y, contentWidth, panelH, 10);
      doc.fillAndStroke(COLORS.panel, COLORS.border);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(COLORS.navy)
        .text("Payment instructions", leftX + 16, y + 14);

      let py = y + 36;
      if (pairLines.length === 0 && noteLines.length === 0) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(COLORS.slate)
          .text(
            "Please contact your broker administrator for payment instructions.",
            leftX + 16,
            py,
            { width: contentWidth - 32 },
          );
      } else {
        for (const [label, value] of pairLines) {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(COLORS.slate)
            .text(label, leftX + 16, py, { width: 120 });
          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(COLORS.black)
            .text(value, leftX + 140, py, { width: contentWidth - 164 });
          py += 22;
        }
        for (const note of noteLines) {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(COLORS.slate)
            .text(note, leftX + 16, py, { width: contentWidth - 32 });
          py +=
            doc.heightOfString(note, {
              width: contentWidth - 32,
              fontSize: 9,
            }) + 6;
        }
      }

      // —— Footer ——
      const footerY = doc.page.height - 48;
      doc
        .moveTo(margin, footerY)
        .lineTo(pageWidth - margin, footerY)
        .strokeColor(COLORS.border)
        .lineWidth(0.8)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.slate)
        .text(
          "This invoice documents earned commission. Payment is recorded separately by the broker. · Template v2",
          margin,
          footerY + 10,
          { width: contentWidth, align: "center" },
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

function saveCommissionInvoicePdf(buffer, invoiceNumber, existingPdfUrl = null) {
  const uploadDir = ensureInvoiceStorageDir();

  // Prefer overwriting the existing public URL so downloads / static links refresh.
  if (existingPdfUrl) {
    const relative = String(existingPdfUrl).replace(/^\/+/, "");
    if (relative.startsWith("public/broker/commission-invoices/")) {
      const existingPath = path.join(process.cwd(), relative);
      fs.writeFileSync(existingPath, buffer);
      return `/${relative.replace(/\\/g, "/")}`;
    }
  }

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
  sanitizePaymentInstructions,
};
