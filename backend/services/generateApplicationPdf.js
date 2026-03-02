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

      /* ================== HEADER ================== */

      doc
        .fontSize(24)
        .fillColor("#0A3D62")
        .text("LendingCart", { align: "center" });

      doc
        .moveDown(0.3)
        .fontSize(16)
        .fillColor("#000")
        .text("Loan Application Document", { align: "center" });

      doc.moveDown(1.5);

      /* ================== APPLICATION OVERVIEW ================== */

      doc
        .fontSize(14)
        .fillColor("#0A3D62")
        .text("Application Overview");

      doc.moveDown(0.5);

      const overviewFields = [
        ["Application ID", application.id],
        ["Loan Product Code", application.loanProductCode],
        ["Amount Requested", application.amountRequested || "N/A"],
        ["Application Status", application.status],
        ["Created At", application.createdAt],
        ["Updated At", application.updatedAt],
      ];

      overviewFields.forEach(([label, value]) => {
        doc
          .fontSize(12)
          .fillColor("#000")
          .text(`${label}:`, { continued: true })
          .font("Helvetica-Bold")
          .text(` ${value || "N/A"}`)
          .font("Helvetica")
          .moveDown(0.4);
      });

      doc.moveDown(1);

      /* ================== BORROWER FULL DATA ================== */

      doc
        .fontSize(14)
        .fillColor("#0A3D62")
        .text("Complete Borrower Information");

      doc.moveDown(0.7);

      const pageWidth = doc.page.width - doc.options.margin * 2;
      const labelWidth = 200;
      const valueWidth = pageWidth - labelWidth;

      submission.fields.forEach((field) => {
        const label = field.fieldKey || "Unknown Field";

        let value;
        try {
          value =
            typeof field.value === "object"
              ? JSON.stringify(field.value, null, 2)
              : String(field.value);
        } catch {
          value = "N/A";
        }

        const startY = doc.y;

        // Check page overflow
        if (startY > doc.page.height - 100) {
          doc.addPage();
        }

        doc
          .fontSize(11)
          .fillColor("#333")
          .text(label, {
            width: labelWidth,
            continued: true,
          });

        doc
          .font("Helvetica-Bold")
          .text(` : ${value}`, {
            width: valueWidth,
          });

        doc.font("Helvetica").moveDown(0.5);
      });

      /* ================== RAW APPLICATION DATA (FAILSAFE) ================== */

      doc.addPage();

      doc
        .fontSize(14)
        .fillColor("#0A3D62")
        .text("Raw Application Data Snapshot");

      doc.moveDown(1);

      const applicationData = JSON.stringify(application, null, 2);

      doc
        .fontSize(9)
        .fillColor("#000")
        .text(applicationData, {
          width: pageWidth,
        });

      /* ================== FOOTER ================== */

      doc.moveDown(2);

      doc
        .fontSize(10)
        .fillColor("#888")
        .text(
          `Generated on ${new Date().toLocaleString()}`,
          0,
          doc.page.height - 50,
          {
            align: "center",
          }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateApplicationPDF;