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

      const pageWidth = doc.page.width - doc.options.margin * 2;
      const tableStartX = 50;
      const labelWidth = 220;
      const valueWidth = pageWidth - labelWidth;
      const rowPadding = 8;

      /* ================= HEADER ================= */

      doc
        .fontSize(22)
        .fillColor("#0A3D62")
        .text("LendingCart", { align: "center" });

      doc
        .moveDown(0.3)
        .fontSize(16)
        .fillColor("#000")
        .text("Loan Application Document", { align: "center" });

      doc.moveDown(1.5);

      /* ================= APPLICATION OVERVIEW TABLE ================= */

      doc
        .fontSize(14)
        .fillColor("#0A3D62")
        .text("Application Overview");

      doc.moveDown(0.7);

      const overviewFields = [
        ["Application ID", application.id],
        ["Loan Product Code", application.loanProductCode],
        ["Amount Requested", application.amountRequested || "N/A"],
        ["Application Status", application.status],
        ["Created At", application.createdAt],
        ["Updated At", application.updatedAt],
      ];

      overviewFields.forEach(([label, value]) => {
        drawTableRow(doc, label, value);
      });

      doc.moveDown(1.5);

      /* ================= BORROWER FULL DATA TABLE ================= */

      doc
        .fontSize(14)
        .fillColor("#0A3D62")
        .text("Complete Borrower Information");

      doc.moveDown(0.7);

      let signatureBase64 = null;

      submission.fields.forEach((field) => {
        const label = field.fieldKey || "Unknown Field";

        let value;
        try {
          value =
            typeof field.value === "object"
              ? JSON.stringify(field.value)
              : String(field.value);
        } catch {
          value = "N/A";
        }

        // Detect signature field
        if (
          typeof value === "string" &&
          value.startsWith("data:image")
        ) {
          signatureBase64 = value;
          drawTableRow(doc, label, "Digitally Signed");
        } else {
          drawTableRow(doc, label, value);
        }
      });

      /* ================= SIGNATURE SECTION ================= */

      if (signatureBase64) {
        doc.addPage();

        doc
          .fontSize(16)
          .fillColor("#0A3D62")
          .text("Applicant Signature");

        doc.moveDown(1);

        const base64Data = signatureBase64.replace(
          /^data:image\/png;base64,/,
          ""
        );

        const signatureBuffer = Buffer.from(base64Data, "base64");

        doc.image(signatureBuffer, {
          fit: [250, 120],
          align: "left",
        });

        doc.moveDown(2);

        doc
          .moveTo(doc.x, doc.y)
          .lineTo(doc.x + 250, doc.y)
          .stroke();

        doc.text("Authorized Signature", { align: "left" });
      }

      /* ================= FOOTER ================= */

      doc
        .fontSize(10)
        .fillColor("#888")
        .text(
          `Generated on ${new Date().toLocaleString()}`,
          0,
          doc.page.height - 40,
          { align: "center" }
        );

      doc.end();

      /* ================= TABLE ROW FUNCTION ================= */

      function drawTableRow(doc, label, value) {
        const y = doc.y;

        // Auto page break
        if (y > doc.page.height - 100) {
          doc.addPage();
        }

        const rowHeight =
          Math.max(
            doc.heightOfString(label, { width: labelWidth }),
            doc.heightOfString(value, { width: valueWidth })
          ) + rowPadding;

        // Label Cell
        doc
          .rect(tableStartX, doc.y, labelWidth, rowHeight)
          .stroke();

        doc
          .fontSize(11)
          .fillColor("#333")
          .text(label, tableStartX + 5, doc.y + 5, {
            width: labelWidth - 10,
          });

        // Value Cell
        doc
          .rect(tableStartX + labelWidth, doc.y, valueWidth, rowHeight)
          .stroke();

        doc
          .font("Helvetica-Bold")
          .text(String(value || "N/A"), tableStartX + labelWidth + 5, doc.y + 5, {
            width: valueWidth - 10,
          })
          .font("Helvetica");

        doc.moveDown(rowHeight / 12);
      }
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateApplicationPDF;