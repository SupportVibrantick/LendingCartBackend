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

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 100;

      /* ================= HEADER ================= */

      doc.rect(0, 0, pageWidth, 90).fill("#0A3D62");

      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(24)
        .text("LendingCart", 50, 30);

      doc
        .font("Helvetica")
        .fontSize(14)
        .text("Loan Application Document", 50, 60);

      doc.moveDown(4);

      /* ================= SECTION TITLE ================= */

      function sectionTitle(title) {
        doc.moveDown(1.5);

        doc
          .fillColor("#0A3D62")
          .font("Helvetica-Bold")
          .fontSize(16)
          .text(title);

        doc.moveDown(0.5);

        doc
          .moveTo(50, doc.y)
          .lineTo(pageWidth - 50, doc.y)
          .strokeColor("#E2E8F0")
          .stroke();

        doc.moveDown(0.8);
      }

      /* ================= TWO COLUMN ROW ================= */

      function drawTwoColumnRow(fields) {
        const startX = 50;
        const columnGap = 20;
        const columnWidth = contentWidth / 2 - columnGap / 2;
        const rowPadding = 14;

        if (doc.y > doc.page.height - 130) {
          doc.addPage();
        }

        const heights = fields.map((field) =>
          Math.max(
            doc.heightOfString(field.label, {
              width: columnWidth - 20,
            }),
            doc.heightOfString(String(field.value || "N/A"), {
              width: columnWidth - 20,
            })
          )
        );

        const rowHeight = Math.max(...heights) + rowPadding * 2;

        fields.forEach((field, index) => {
          const x = startX + index * (columnWidth + columnGap);

          // Card Background
          doc
            .roundedRect(x, doc.y, columnWidth, rowHeight, 6)
            .fillAndStroke("#F8FAFC", "#E2E8F0");

          // Label
          doc
            .fillColor("#64748B")
            .font("Helvetica")
            .fontSize(10)
            .text(field.label, x + 12, doc.y + 10, {
              width: columnWidth - 24,
            });

          // Value
          doc
            .fillColor("#0F172A")
            .font("Helvetica-Bold")
            .fontSize(12)
            .text(String(field.value || "N/A"), x + 12, doc.y + 28, {
              width: columnWidth - 24,
            });
        });

        doc.moveDown(rowHeight / 15);
      }

      /* ================= APPLICATION OVERVIEW ================= */

      sectionTitle("Application Overview");

      const overviewFields = [
        { label: "Application ID", value: application.id },
        { label: "Loan Product Code", value: application.loanProductCode },
        { label: "Amount Requested", value: application.amountRequested || "N/A" },
        { label: "Application Status", value: application.status },
        { label: "Created At", value: application.createdAt },
        { label: "Updated At", value: application.updatedAt },
      ];

      for (let i = 0; i < overviewFields.length; i += 2) {
        drawTwoColumnRow([
          overviewFields[i],
          overviewFields[i + 1] || { label: "", value: "" },
        ]);
      }

      /* ================= BORROWER SECTION ================= */

      sectionTitle("Complete Borrower Information");

      let signatureBase64 = null;
      const borrowerFields = [];

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

        if (typeof value === "string" && value.startsWith("data:image")) {
          signatureBase64 = value;
          borrowerFields.push({
            label,
            value: "Digitally Signed",
          });
        } else {
          borrowerFields.push({ label, value });
        }
      });

      for (let i = 0; i < borrowerFields.length; i += 2) {
        drawTwoColumnRow([
          borrowerFields[i],
          borrowerFields[i + 1] || { label: "", value: "" },
        ]);
      }

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
          .roundedRect(50, doc.y, 300, 150, 8)
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

      /* ================= FOOTER ================= */

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