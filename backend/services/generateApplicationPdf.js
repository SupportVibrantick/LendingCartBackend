const PDFDocument = require("pdfkit");

const generateApplicationPDF = (application, submission) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      /* ================= HEADER ================= */

      doc
        .fontSize(22)
        .fillColor("#0a3d62")
        .text("LendingCart", { align: "center" });

      doc
        .moveDown(0.5)
        .fontSize(16)
        .fillColor("#000000")
        .text("Loan Application Summary", { align: "center" });

      doc.moveDown(2);

      /* ================= APPLICATION DETAILS ================= */

      doc
        .fontSize(14)
        .fillColor("#0a3d62")
        .text("Application Details");

      doc.moveDown(0.5);

      doc
        .fontSize(12)
        .fillColor("#000000")
        .text(`Application ID: ${application.id}`)
        .text(`Loan Product: ${application.loanProductCode}`)
        .text(`Amount Requested: ₹${application.amountRequested || "N/A"}`)
        .text(`Status: ${application.status}`);

      doc.moveDown(2);

      /* ================= SUBMISSION TABLE ================= */

      doc
        .fontSize(14)
        .fillColor("#0a3d62")
        .text("Borrower Information");

      doc.moveDown(1);

      const startX = 50;
      let startY = doc.y;

      const columnWidth1 = 220;
      const columnWidth2 = 250;
      const rowHeight = 25;

      submission.fields.forEach((field, index) => {
        const y = startY + index * rowHeight;

        // Draw row borders
        doc
          .rect(startX, y, columnWidth1, rowHeight)
          .stroke();

        doc
          .rect(startX + columnWidth1, y, columnWidth2, rowHeight)
          .stroke();

        // Field Name
        doc
          .fontSize(11)
          .fillColor("#000")
          .text(field.fieldKey, startX + 5, y + 8, {
            width: columnWidth1 - 10,
          });

        // Field Value
        doc
          .text(String(field.value), startX + columnWidth1 + 5, y + 8, {
            width: columnWidth2 - 10,
          });
      });

      doc.moveDown(4);

      /* ================= FOOTER ================= */

      doc
        .moveDown(2)
        .fontSize(10)
        .fillColor("#888888")
        .text(
          `Generated on ${new Date().toLocaleString()}`,
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateApplicationPDF;