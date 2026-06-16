const PDFDocument = require("pdfkit");

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric)) return String(value);
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

const pickField = (fieldMap, ...keys) => {
  for (const key of keys) {
    const value = fieldMap?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "—";
};

/**
 * Generate a simple LOI PDF when LibreOffice/docx conversion is unavailable.
 */
function generateLoiPdf({
  applicationNumber,
  lenderName,
  approvedAmount,
  interestRate,
  notes,
  date,
  fieldMap = {},
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const borrowerName = [
        pickField(fieldMap, "borrowerFirstName", "firstName"),
        pickField(fieldMap, "borrowerLastName", "lastName"),
      ]
        .filter((part) => part !== "—")
        .join(" ")
        .trim();

      const propertyAddress = pickField(
        fieldMap,
        "propertyAddress",
        "property_address",
        "address",
      );

      doc.fontSize(20).font("Helvetica-Bold").text("Letter of Intent", {
        align: "center",
      });

      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#475569")
        .text(date || new Date().toLocaleDateString(), { align: "right" });

      doc.moveDown(2);
      doc.fillColor("#0f172a");

      doc.fontSize(11).font("Helvetica-Bold").text("Lender");
      doc.font("Helvetica").text(lenderName || "—");

      doc.moveDown(1);
      doc.font("Helvetica-Bold").text("Application");
      doc.font("Helvetica").text(applicationNumber || "—");

      doc.moveDown(1.5);
      doc.font("Helvetica").text(
        `This Letter of Intent outlines preliminary loan terms for ${
          borrowerName !== "—" ? borrowerName : "the borrower"
        }.`,
      );

      doc.moveDown(1.5);
      doc.font("Helvetica-Bold").text("Proposed Terms");
      doc.moveDown(0.5);

      const terms = [
        ["Approved Amount", formatCurrency(approvedAmount)],
        ["Interest Rate", interestRate ? `${interestRate}%` : "—"],
        [
          "Requested Amount",
          formatCurrency(
            pickField(fieldMap, "amountRequested", "loanAmount", "loan_amount"),
          ),
        ],
        [
          "Loan Product",
          pickField(fieldMap, "loanProductCode", "loan_product", "productCode"),
        ],
        ["Property", propertyAddress],
        [
          "Borrower Email",
          pickField(fieldMap, "email", "borrowerEmail"),
        ],
      ];

      terms.forEach(([label, value]) => {
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(value);
        doc.moveDown(0.35);
      });

      if (notes) {
        doc.moveDown(0.75);
        doc.font("Helvetica-Bold").text("Lender Notes");
        doc.font("Helvetica").text(String(notes));
      }

      doc.moveDown(2);
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(
          "This document is generated electronically and is subject to final underwriting approval.",
          { align: "left" },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateLoiPdf };
