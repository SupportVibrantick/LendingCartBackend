const PDFDocument = require("pdfkit");

const generateApplicationPDF = (application, submission) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 100;

      /* ================= HEADER ================= */

      doc.rect(0, 0, pageWidth, 90).fill("#0A3D62");

      doc.fillColor("#fff")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("LendingCart", 50, 30);

      doc.fontSize(14)
        .font("Helvetica")
        .text("Loan Application Document", 50, 60);

      doc.moveDown(4);

      /* ================= STATUS ================= */

      doc.fillColor("#000")
        .fontSize(11)
        .font("Helvetica")
        .text(`Status: ${application.status}`, 50);

      doc.moveDown(1.5);

      /* ================= STATS BOX ================= */

      const statsStartY = doc.y;
      const statWidth = contentWidth / 6;
      const statHeight = 70;

      const stats = [
        { label: "Loan Amount", value: `$${Number(application.amountRequested || 0).toLocaleString()}` },
        { label: "LTV %", value: application.ltvPercentage || "—" },
        { label: "LTC %", value: application.ltcPercentage || "—" },
        { label: "ARV %", value: application.arvPercentage || "—" },
        { label: "DSCR", value: application.dscr || "—" },
        { label: "Net Worth", value: `$${Number(application.netWorth || 0).toLocaleString()}` },
      ];

      stats.forEach((stat, i) => {
        const x = 50 + i * statWidth;

        doc.roundedRect(x, statsStartY, statWidth - 5, statHeight, 8)
          .fillAndStroke("#F0F6FF", "#D6E4FF");

        doc.fillColor("#64748B")
          .fontSize(9)
          .text(stat.label, x + 8, statsStartY + 10, {
            width: statWidth - 16,
            align: "center",
          });

        doc.fillColor("#0F172A")
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(stat.value, x + 8, statsStartY + 30, {
            width: statWidth - 16,
            align: "center",
          });
      });

      doc.moveDown(5);

      /* ================= SECTION TITLE ================= */

      function sectionTitle(title) {
        doc.moveDown(1.5);
        doc.fillColor("#0A3D62")
          .font("Helvetica-Bold")
          .fontSize(14)
          .text(title);

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y)
          .lineTo(pageWidth - 50, doc.y)
          .strokeColor("#E2E8F0")
          .stroke();
        doc.moveDown(1);
      }

      /* ================= TWO COLUMN FIELD GRID ================= */

      function drawFieldGrid(fields) {
        const columnGap = 20;
        const colWidth = contentWidth / 2 - columnGap / 2;

        for (let i = 0; i < fields.length; i += 2) {
          if (doc.y > doc.page.height - 120) doc.addPage();

          const pair = [fields[i], fields[i + 1]];

          const rowHeight = 65;

          pair.forEach((field, index) => {
            if (!field) return;

            const x = 50 + index * (colWidth + columnGap);

            doc.roundedRect(x, doc.y, colWidth, rowHeight, 8)
              .fillAndStroke("#F8FAFC", "#E2E8F0");

            doc.fillColor("#64748B")
              .fontSize(9)
              .font("Helvetica")
              .text(field.label, x + 12, doc.y + 10);

            doc.fillColor("#0F172A")
              .fontSize(11)
              .font("Helvetica-Bold")
              .text(field.value || "-", x + 12, doc.y + 28, {
                width: colWidth - 24,
              });
          });

          doc.moveDown(4);
        }
      }

      /* ================= PRIMARY BORROWER ================= */

      sectionTitle("Primary Borrower");

      const primaryFields = submission.fields
        .filter(f => f.fieldKey.startsWith("borrower") || f.fieldKey === "city" || f.fieldKey === "state")
        .map(f => ({
          label: f.fieldKey,
          value: String(f.value || "-")
        }));

      drawFieldGrid(primaryFields);

      /* ================= LOAN DETAILS ================= */

      sectionTitle("Loan Details");

      const loanFields = submission.fields
        .filter(f => !f.fieldKey.startsWith("borrower"))
        .map(f => ({
          label: f.fieldKey,
          value: String(f.value || "-")
        }));

      drawFieldGrid(loanFields);

      /* ================= SIGNATURE ================= */

      const signatureField = submission.fields.find(
        f => typeof f.value === "string" && f.value.startsWith("data:image")
      );

      if (signatureField) {
        doc.addPage();
        sectionTitle("Digital Signature");

        const base64Data = signatureField.value.replace(/^data:image\/png;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        doc.roundedRect(50, doc.y, 300, 150, 10)
          .strokeColor("#CBD5E1")
          .stroke();

        doc.image(buffer, 60, doc.y + 10, {
          fit: [280, 120],
        });

        doc.moveDown(10);
      }

      /* ================= FOOTER ================= */

      const submitted = new Date(submission.submittedAt);

      doc.fontSize(9)
        .fillColor("#64748B")
        .text(
          `Submitted Date: ${submitted.toLocaleDateString()}    |    Submitted Time: ${submitted.toLocaleTimeString()}`,
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