const PDFDocument = require("pdfkit");

const generateApplicationPDF = (application, submission) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];

      // Collect PDF chunks properly
      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      // When finished, return full buffer
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      // Catch PDF errors
      doc.on("error", (err) => {
        reject(err);
      });

      /* ===============================
         PDF CONTENT
      =============================== */

      // Header
      doc
        .fontSize(18)
        .text("LendingCart - Loan Application", { align: "center" });
      doc.moveDown(2);

      // Application Info
      doc.fontSize(12);
      doc.text(`Application ID: ${application.id}`);
      doc.text(`Loan Product: ${application.loanProductCode}`);
      doc.text(`Amount Requested: ${application.amountRequested || "N/A"}`);
      doc.text(`Status: ${application.status}`);
      doc.moveDown(2);

      // Submission Fields
      doc.fontSize(14).text("Submission Details:");
      doc.moveDown(1);

      if (submission?.fields?.length) {
        submission.fields.forEach((field) => {
          doc
            .fontSize(12)
            .text(`${field.fieldKey}: ${JSON.stringify(field.value)}`, {
              width: 500,
            });
          doc.moveDown(0.5);
        });
      } else {
        doc.fontSize(12).text("No submission fields available.");
      }

      // IMPORTANT: finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateApplicationPDF;