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
      const rowPadding = 10;

      /* ================= MODERN HEADER ================= */

      doc
        .rect(0, 0, doc.page.width, 90)
        .fill("#0A3D62");

      doc
        .fillColor("#ffffff")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("LendingCart", 50, 30);

      doc
        .fontSize(14)
        .font("Helvetica")
        .text("Loan Application Document", 50, 60);

      doc.moveDown(3);

      /* ================= SECTION FUNCTION ================= */

      function sectionTitle(title) {
        doc.moveDown(1.5);
        doc
          .fontSize(15)
          .fillColor("#0A3D62")
          .font("Helvetica-Bold")
          .text(title);
        doc.moveDown(0.5);

        doc
          .moveTo(50, doc.y)
          .lineTo(doc.page.width - 50, doc.y)
          .strokeColor("#E0E6ED")
          .stroke();

        doc.moveDown(0.8);
      }

      /* ================= TABLE ROW FUNCTION ================= */

      function drawTableRow(doc, label, value) {
        const y = doc.y;

        if (y > doc.page.height - 100) {
          doc.addPage();
        }

        const rowHeight =
          Math.max(
            doc.heightOfString(label, { width: labelWidth }),
            doc.heightOfString(String(value || "N/A"), {
              width: valueWidth,
            })
          ) + rowPadding;

        // Light background
        doc
          .rect(tableStartX, doc.y, pageWidth, rowHeight)
          .fillAndStroke("#F8FAFC", "#E5E7EB");

        // Label
        doc
          .fillColor("#475569")
          .fontSize(11)
          .font("Helvetica")
          .text(label, tableStartX + 10, doc.y + 8, {
            width: labelWidth - 20,
          });

        // Value
        doc
          .fillColor("#0F172A")
          .font("Helvetica-Bold")
          .text(String(value || "N/A"), tableStartX + labelWidth + 10, doc.y + 8, {
            width: valueWidth - 20,
          })
          .font("Helvetica");

        doc.moveDown(rowHeight / 12);
      }

      /* ================= APPLICATION OVERVIEW ================= */

      sectionTitle("Application Overview");

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

      /* ================= BORROWER DATA ================= */

      sectionTitle("Complete Borrower Information");

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

      /* ================= SIGNATURE PAGE ================= */

      if (signatureBase64) {
        doc.addPage();

        sectionTitle("Applicant Digital Signature");

        const base64Data = signatureBase64.replace(
          /^data:image\/png;base64,/,
          ""
        );

        const signatureBuffer = Buffer.from(base64Data, "base64");

        doc
          .rect(50, doc.y, 300, 150)
          .strokeColor("#CBD5E1")
          .stroke();

        doc.image(signatureBuffer, 60, doc.y + 10, {
          fit: [280, 120],
        });

        doc.moveDown(10);

        doc
          .fontSize(11)
          .fillColor("#64748B")
          .text("Authorized Signature", 50);
      }

      /* ================= PROFESSIONAL FOOTER ================= */

      doc
        .fontSize(9)
        .fillColor("#94A3B8")
        .text(
          `Generated on ${new Date().toLocaleString()}`,
          0,
          doc.page.height - 40,
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = generateApplicationPDF;