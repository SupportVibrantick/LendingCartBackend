const PDFDocument = require("pdfkit");

const formatLabel = (key) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase());
};

const generateApplicationPDF = (application, submission) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      const buffers = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 100;

      const COLORS = {
        primary: "#0A3D62",
        border: "#E2E8F0",
        muted: "#64748B",
        text: "#0F172A",
        bg: "#F8FAFC",
        statBg: "#F1F5F9"
      };

      /* ================= HEADER ================= */

      doc.rect(0, 0, pageWidth, 85).fill(COLORS.primary);

      doc.fillColor("#fff")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("LendingCart", 50, 30);

      doc.fontSize(12)
        .font("Helvetica")
        .text("Loan Application Summary", 50, 58);

      doc.moveDown(4);

      /* ================= STATUS ================= */

      doc.fillColor(COLORS.text)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`Application Status: ${application.status}`);

      doc.moveDown(1.5);

      /* ================= STATS ================= */

      const statWidth = contentWidth / 3 - 10;
      const statHeight = 60;

      const stats = [
        { label: "Loan Amount", value: `$${Number(application.amountRequested || 0).toLocaleString()}` },
        { label: "LTV", value: application.ltvPercentage || "—" },
        { label: "LTC", value: application.ltcPercentage || "—" },
        { label: "ARV", value: application.arvPercentage || "—" },
        { label: "DSCR", value: application.dscr || "—" },
        { label: "Net Worth", value: `$${Number(application.netWorth || 0).toLocaleString()}` },
      ];

      const startY = doc.y;

      stats.forEach((stat, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;

        const x = 50 + col * (statWidth + 10);
        const y = startY + row * (statHeight + 10);

        doc.roundedRect(x, y, statWidth, statHeight, 6)
          .fillAndStroke(COLORS.statBg, COLORS.border);

        doc.fillColor(COLORS.muted)
          .fontSize(9)
          .font("Helvetica")
          .text(stat.label, x + 10, y + 10);

        doc.fillColor(COLORS.text)
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(stat.value, x + 10, y + 28);
      });

      doc.y = startY + 150;

      /* ================= SECTION TITLE ================= */

      function section(title) {
        doc.moveDown(1);

        doc.fillColor(COLORS.primary)
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(title);

        doc.moveDown(0.4);

        doc.moveTo(50, doc.y)
          .lineTo(pageWidth - 50, doc.y)
          .strokeColor(COLORS.border)
          .stroke();

        doc.moveDown(0.7);
      }

      /* ================= FIELD GRID ================= */

      function drawFields(fields) {

        const columnGap = 20;
        const colWidth = contentWidth / 2 - columnGap / 2;
        const rowHeight = 50;

        for (let i = 0; i < fields.length; i += 2) {

          if (doc.y > doc.page.height - 120) doc.addPage();

          const y = doc.y;

          [fields[i], fields[i + 1]].forEach((field, index) => {

            if (!field) return;

            const x = 50 + index * (colWidth + columnGap);

            doc.roundedRect(x, y, colWidth, rowHeight, 6)
              .fillAndStroke(COLORS.bg, COLORS.border);

            doc.fillColor(COLORS.muted)
              .fontSize(9)
              .font("Helvetica")
              .text(field.label, x + 10, y + 8);

            doc.fillColor(COLORS.text)
              .fontSize(11)
              .font("Helvetica-Bold")
              .text(field.value || "-", x + 10, y + 22, {
                width: colWidth - 20
              });

          });

          doc.y += rowHeight + 10;
        }
      }

      /* ================= PRIMARY BORROWER ================= */

      section("Borrower Information");

      const borrowerFields = submission.fields
        .filter(f => f.fieldKey.toLowerCase().includes("borrower"))
        .map(f => ({
          label: formatLabel(f.fieldKey),
          value: String(f.value || "-")
        }));

      drawFields(borrowerFields);

      /* ================= PROPERTY / LOAN ================= */

      section("Loan Details");

      const loanFields = submission.fields
        .filter(f => !f.fieldKey.toLowerCase().includes("borrower"))
        .map(f => ({
          label: formatLabel(f.fieldKey),
          value: String(f.value || "-")
        }));

      drawFields(loanFields);

      /* ================= SIGNATURE ================= */

      const signature = submission.fields.find(
        f => typeof f.value === "string" && f.value.startsWith("data:image")
      );

      if (signature) {

        doc.addPage();

        section("Digital Signature");

        const base64 = signature.value.replace(/^data:image\/png;base64,/, "");
        const buffer = Buffer.from(base64, "base64");

        doc.roundedRect(50, doc.y, 350, 150, 8)
          .strokeColor(COLORS.border)
          .stroke();

        doc.image(buffer, 60, doc.y + 10, {
          fit: [330, 120]
        });

        doc.moveDown(8);
      }

      /* ================= FOOTER ================= */

      const submitted = new Date(submission.submittedAt);

      doc.fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          `Submitted: ${submitted.toLocaleDateString()}  |  ${submitted.toLocaleTimeString()}`,
          0,
          doc.page.height - 40,
          { align: "center" }
        );

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateApplicationPDF;