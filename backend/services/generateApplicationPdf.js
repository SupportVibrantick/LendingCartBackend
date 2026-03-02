const PDFDocument = require("pdfkit");

const generateApplicationPDF = (application, submission) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });

      // Header
      doc
        .fontSize(18)
        .text("LendingCart - Loan Application", { align: "center" })
        .moveDown();

      // Basic Info
      doc.fontSize(12);
      doc.text(`Application ID: ${application.id}`);
      doc.text(`Loan Product: ${application.loanProductCode}`);
      doc.text(`Amount Requested: ${application.amountRequested || "N/A"}`);
      doc.text(`Status: ${application.status}`);
      doc.moveDown();

      doc.fontSize(14).text("Submission Details:");
      doc.moveDown();

      submission.fields.forEach((field) => {
        doc
          .fontSize(12)
          .text(`${field.fieldKey}: ${JSON.stringify(field.value)}`);
        doc.moveDown(0.5);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateApplicationPDF;