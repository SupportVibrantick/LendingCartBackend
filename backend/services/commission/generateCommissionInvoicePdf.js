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
      const margin = 36;
      // Zero margins + absolute positioning keeps the invoice on one page.
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      const buffers = [];
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - margin * 2;

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // —— Header ——
      const headerH = 58;
      doc.save();
      doc.rect(0, 0, pageWidth, headerH).fill(COLORS.accent);
      doc
        .font("Helvetica-Bold")
        .fontSize(17)
        .fillColor(COLORS.white)
        .text("Commission Invoice", margin, 14, {
          width: contentWidth * 0.55,
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#cbd5e1")
        .text("Loan Automation", margin, 36, {
          width: contentWidth * 0.55,
          lineBreak: false,
        });

      const metaX = margin + contentWidth * 0.52;
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text("INVOICE NUMBER", metaX, 12, {
          width: contentWidth * 0.48,
          align: "right",
          lineBreak: false,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.white)
        .text(invoiceNumber || "—", metaX, 24, {
          width: contentWidth * 0.48,
          align: "right",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#cbd5e1")
        .text(formatDate(invoiceDate), metaX, 38, {
          width: contentWidth * 0.48,
          align: "right",
          lineBreak: false,
        });
      doc.restore();

      let y = headerH + 14;
      const leftX = margin;
      const colGap = 10;
      const colWidth = (contentWidth - colGap) / 2;
      const rightX = margin + colWidth + colGap;

      // —— From / Bill to ——
      const partyH = 48;
      doc.roundedRect(leftX, y, colWidth, partyH, 5).fillAndStroke(
        COLORS.panel,
        COLORS.border,
      );
      doc.roundedRect(rightX, y, colWidth, partyH, 5).fillAndStroke(
        COLORS.panel,
        COLORS.border,
      );

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.slate)
        .text("FROM", leftX + 10, y + 8, { lineBreak: false });
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.black)
        .text(brokerOrg?.name || "Broker", leftX + 10, y + 20, {
          width: colWidth - 20,
          lineBreak: false,
        });
      if (brokerOrg?.email) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(COLORS.slate)
          .text(brokerOrg.email, leftX + 10, y + 33, {
            width: colWidth - 20,
            lineBreak: false,
          });
      }

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.slate)
        .text("BILL TO", rightX + 10, y + 8, { lineBreak: false });
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.black)
        .text(formatPerson(recipientUser), rightX + 10, y + 20, {
          width: colWidth - 20,
          lineBreak: false,
        });
      if (recipientUser?.email) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(COLORS.slate)
          .text(recipientUser.email, rightX + 10, y + 33, {
            width: colWidth - 20,
            lineBreak: false,
          });
      }

      y += partyH + 12;

      // —— Deal summary ——
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.navy)
        .text("Deal summary", leftX, y, { lineBreak: false });
      y += 12;

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
      const rowH = 20;
      const labelColW = contentWidth * 0.4;
      const tableH = rows.length * rowH;

      doc
        .roundedRect(leftX, tableTop, contentWidth, tableH, 5)
        .fillAndStroke(COLORS.white, COLORS.border);

      rows.forEach(([label, value], index) => {
        const rowY = tableTop + index * rowH;
        if (index % 2 === 1) {
          doc.rect(leftX + 1, rowY, contentWidth - 2, rowH).fill(COLORS.panel);
        }
        if (index > 0) {
          doc
            .moveTo(leftX + 8, rowY)
            .lineTo(leftX + contentWidth - 8, rowY)
            .strokeColor(COLORS.border)
            .lineWidth(0.5)
            .stroke();
        }
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.slate)
          .text(label, leftX + 12, rowY + 5, {
            width: labelColW - 14,
            lineBreak: false,
          });
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(COLORS.black)
          .text(value, leftX + labelColW, rowY + 5, {
            width: contentWidth - labelColW - 14,
            align: "right",
            lineBreak: false,
          });
      });

      y = tableTop + tableH + 10;

      // —— Amount due ——
      const amountH = 42;
      doc
        .roundedRect(leftX, y, contentWidth, amountH, 6)
        .fillAndStroke(COLORS.amountBg, COLORS.amountBorder);
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.slate)
        .text("AMOUNT DUE", leftX + 14, y + 8, { lineBreak: false });
      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(COLORS.accent)
        .text(formatCurrency(commissionAmount), leftX + 14, y + 19, {
          width: contentWidth - 28,
          lineBreak: false,
        });

      y += amountH + 10;

      // —— Payment instructions (2-col) ——
      const instructionLines = parseInstructionLines(paymentInstructions);
      const pairLines = [];
      const noteLines = [];
      for (const line of instructionLines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) pairLines.push([match[1].trim(), match[2].trim()]);
        else noteLines.push(line);
      }

      const pairRowH = 15;
      const pairRows = Math.max(1, Math.ceil(pairLines.length / 2));
      const notesJoined = noteLines.join(" ");
      const notesH = notesJoined ? 22 : 0;
      const panelH = 24 + pairRows * pairRowH + notesH + 8;

      doc
        .roundedRect(leftX, y, contentWidth, panelH, 6)
        .fillAndStroke(COLORS.panel, COLORS.border);

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.navy)
        .text("Payment instructions", leftX + 12, y + 8, { lineBreak: false });

      let py = y + 22;
      if (!pairLines.length && !notesJoined) {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(COLORS.slate)
          .text(
            "Please contact your broker administrator for payment instructions.",
            leftX + 12,
            py,
            { width: contentWidth - 24, lineBreak: false },
          );
      } else {
        const pairColW = (contentWidth - 24) / 2;
        for (let i = 0; i < pairLines.length; i += 2) {
          const left = pairLines[i];
          const right = pairLines[i + 1];
          const rowY = py + (i / 2) * pairRowH;

          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.slate)
            .text(`${left[0]}:`, leftX + 12, rowY, {
              width: 72,
              lineBreak: false,
            });
          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor(COLORS.black)
            .text(left[1], leftX + 84, rowY, {
              width: pairColW - 84,
              lineBreak: false,
            });

          if (right) {
            doc
              .font("Helvetica")
              .fontSize(8)
              .fillColor(COLORS.slate)
              .text(`${right[0]}:`, leftX + 12 + pairColW, rowY, {
                width: 72,
                lineBreak: false,
              });
            doc
              .font("Helvetica-Bold")
              .fontSize(8)
              .fillColor(COLORS.black)
              .text(right[1], leftX + 84 + pairColW, rowY, {
                width: pairColW - 84,
                lineBreak: false,
              });
          }
        }
        py += pairRows * pairRowH + 2;

        if (notesJoined) {
          doc
            .font("Helvetica")
            .fontSize(7.5)
            .fillColor(COLORS.slate)
            .text(notesJoined, leftX + 12, py, {
              width: contentWidth - 24,
              height: 20,
              ellipsis: true,
              lineBreak: false,
            });
        }
      }

      // —— Footer ——
      const footerY = pageHeight - 24;
      doc
        .moveTo(margin, footerY - 8)
        .lineTo(pageWidth - margin, footerY - 8)
        .strokeColor(COLORS.border)
        .lineWidth(0.6)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.slate)
        .text(
          "This invoice documents earned commission. Payment is recorded separately by the broker. · Template v2",
          margin,
          footerY - 2,
          { width: contentWidth, align: "center", lineBreak: false },
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
