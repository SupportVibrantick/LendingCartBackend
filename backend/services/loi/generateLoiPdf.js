const PDFDocument = require("pdfkit");

const COLORS = {
  header: "#1e40af",
  accent: "#4f46e5",
  label: "#64748b",
  value: "#312e81",
  border: "#e2e8f0",
  summaryBg: "#eff6ff",
  purposeTag: "#dbeafe",
  purposeText: "#1d4ed8",
  collateralTag: "#dcfce7",
  collateralText: "#166534",
  disclaimerBg: "#f8fafc",
  white: "#ffffff",
  muted: "#94a3b8",
};

const PAGE = {
  width: 612,
  height: 792,
  margin: 48,
  sectionGap: 18,
  bottomSafe: 56,
};

const display = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value).trim();
  if (!text || text === "0" || text === "$0" || text === "0%") return fallback;
  return text;
};

function ensureSpace(doc, height) {
  if (doc.y + height > PAGE.height - PAGE.bottomSafe) {
    doc.addPage();
    doc.y = PAGE.margin;
  }
}

function sectionGap(doc, size = PAGE.sectionGap) {
  doc.y += size;
}

function drawHeader(doc, data) {
  const headerHeight = 136;
  doc.rect(0, 0, PAGE.width, headerHeight).fill(COLORS.header);

  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(9);
  doc.text("Loan Automation", PAGE.margin, 28);
  doc.font("Helvetica").fontSize(8);
  doc.text("Commercial & Private Lending Platform", PAGE.margin, 40);

  doc.font("Helvetica").fontSize(8);
  doc.text(`Loan #: ${display(data.applicationNumber, "")}`, PAGE.width - 190, 28, {
    width: 142,
    align: "right",
  });
  doc.text(`Date: ${display(data.date, "")}`, PAGE.width - 190, 42, {
    width: 142,
    align: "right",
  });

  doc.font("Helvetica-Bold").fontSize(19);
  doc.text("Commercial & Business Loan Term Sheet", PAGE.margin, 64, {
    width: PAGE.width - PAGE.margin * 2,
    align: "center",
  });

  doc.font("Helvetica").fontSize(9);
  doc.text(
    "Conditional Terms — Subject to Underwriting & Final Credit Approval",
    PAGE.margin,
    92,
    { width: PAGE.width - PAGE.margin * 2, align: "center" },
  );

  const bannerY = 112;
  doc
    .roundedRect(PAGE.margin + 36, bannerY, PAGE.width - PAGE.margin * 2 - 72, 24, 6)
    .fillOpacity(0.2)
    .fill(COLORS.white)
    .fillOpacity(1);

  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white);
  doc.text(
    "For Discussion Purposes Only — This is NOT a Commitment to Lend",
    PAGE.margin,
    bannerY + 8,
    { width: PAGE.width - PAGE.margin * 2, align: "center" },
  );

  doc.y = headerHeight + 24;
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 40);
  const y = doc.y;
  doc.roundedRect(PAGE.margin, y, 78, 20, 10).fill(COLORS.accent);

  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(8);
  doc.text(title.toUpperCase(), PAGE.margin + 12, y + 6);

  doc.y = y + 32;
}

function drawFieldCell(doc, x, y, width, label, value, emphasize = false) {
  const shown = display(value, "—");
  doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(7);
  doc.text(label.toUpperCase(), x, y, { width });

  doc
    .fillColor(emphasize && shown !== "—" ? COLORS.value : "#334155")
    .font(emphasize && shown !== "—" ? "Helvetica-Bold" : "Helvetica")
    .fontSize(emphasize && shown !== "—" ? 10 : 9);
  doc.text(shown, x, y + 13, { width });
}

function drawParties(doc, data) {
  drawSectionTitle(doc, "Parties");

  const startY = doc.y;
  const colWidth = (PAGE.width - PAGE.margin * 2 - 24) / 2;

  drawFieldCell(doc, PAGE.margin, startY, colWidth, "Lender Name", data.lenderName, true);
  drawFieldCell(
    doc,
    PAGE.margin + colWidth + 24,
    startY,
    colWidth,
    "Applicant / Borrower",
    data.applicantBorrower,
    true,
  );

  drawFieldCell(doc, PAGE.margin, startY + 42, colWidth, "Broker Name", data.brokerName, true);
  drawFieldCell(
    doc,
    PAGE.margin + colWidth + 24,
    startY + 42,
    colWidth,
    "Guarantors",
    data.guarantors,
    true,
  );

  drawFieldCell(doc, PAGE.margin, startY + 84, colWidth, "Broker Phone", data.brokerPhone, true);
  drawFieldCell(
    doc,
    PAGE.margin + colWidth + 24,
    startY + 84,
    colWidth,
    "Broker Email",
    data.brokerEmail,
    true,
  );

  doc.y = startY + 124;
  sectionGap(doc, 8);
}

function drawSummaryBox(doc, data) {
  ensureSpace(doc, 72);
  const boxY = doc.y;
  const boxHeight = 58;
  const boxWidth = PAGE.width - PAGE.margin * 2;

  doc.roundedRect(PAGE.margin, boxY, boxWidth, boxHeight, 8).fill(COLORS.summaryBg);

  const colWidth = boxWidth / 3;
  const items = [
    ["Loan Approved", data.loanRequest],
    ["Property Value", data.propertyValue],
    ["LTV Ratio", data.ltvRatio],
  ];

  items.forEach(([label, value], index) => {
    const x = PAGE.margin + colWidth * index + 18;
    doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(7);
    doc.text(label.toUpperCase(), x, boxY + 14, { width: colWidth - 28 });
    doc.fillColor(COLORS.value).font("Helvetica-Bold").fontSize(14);
    doc.text(display(value), x, boxY + 30, { width: colWidth - 28 });
  });

  doc.y = boxY + boxHeight + 20;
}

function drawCalculatedMetrics(doc, data) {
  ensureSpace(doc, 110);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Automatically Calculated", PAGE.margin, doc.y);
  sectionGap(doc, 10);

  const boxY = doc.y;
  const boxHeight = 78;
  const boxWidth = PAGE.width - PAGE.margin * 2;
  doc.roundedRect(PAGE.margin, boxY, boxWidth, boxHeight, 8).fill("#f8fafc");

  const items = [
    ["LTV", data.ltvRatio],
    ["LTC", data.ltcRatio],
    ["Monthly Payment", data.monthlyPayment],
    ["Balloon Payment", data.balloonPayment],
    ["Interest Amount", data.interestAmount],
    ["Est. Closing Cost", data.estimatedClosingCost],
    ["APR", data.apr],
  ];

  const colWidth = boxWidth / 4;
  items.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = PAGE.margin + col * colWidth + 12;
    const y = boxY + 12 + row * 34;
    doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(6.5);
    doc.text(label.toUpperCase(), x, y, { width: colWidth - 18 });
    doc.fillColor(COLORS.value).font("Helvetica-Bold").fontSize(10);
    doc.text(display(value), x, y + 12, { width: colWidth - 18 });
  });

  doc.y = boxY + boxHeight + 18;
}

function drawLoanTerms(doc, data) {
  ensureSpace(doc, 120);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Loan Terms", PAGE.margin, doc.y);
  sectionGap(doc, 12);

  const startY = doc.y;
  const colWidth = (PAGE.width - PAGE.margin * 2) / 4;
  const rows = [
    [
      ["Term", data.term],
      ["Amortization", data.amortization],
      ["Interest Rate", data.interestRate],
      ["Fixed Rate Period", data.fixedRatePeriod],
    ],
    [
      ["Monthly Payment", data.monthlyPayment],
      ["Payment Frequency", data.paymentFrequency || data.paymentType || "Monthly"],
      ["Prepayment Penalty", data.prepaymentPenalty],
      ["Property Type", data.propertyType],
    ],
  ];

  rows.forEach((row, rowIndex) => {
    const y = startY + rowIndex * 46;
    row.forEach(([label, value], colIndex) => {
      drawFieldCell(
        doc,
        PAGE.margin + colWidth * colIndex,
        y,
        colWidth - 10,
        label,
        value,
        display(value, "") !== "—" && display(value, "") !== "P & I",
      );
    });

    if (rowIndex === 0) {
      doc
        .moveTo(PAGE.margin, y + 36)
        .lineTo(PAGE.width - PAGE.margin, y + 36)
        .strokeColor(COLORS.border)
        .stroke();
    }
  });

  doc.y = startY + 100;
  sectionGap(doc, 8);
}

function drawFeesTable(doc, data) {
  ensureSpace(doc, 260);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Costs, Fees & Buy-Downs", PAGE.margin, doc.y);
  sectionGap(doc, 10);

  const tableTop = doc.y;
  const tableWidth = PAGE.width - PAGE.margin * 2;
  const columns = [
    { label: "Fee / Cost Item", width: 0.34 },
    { label: "Rate / %", width: 0.18 },
    { label: "Amount ($)", width: 0.24 },
    { label: "When Due", width: 0.24 },
  ];

  doc.rect(PAGE.margin, tableTop, tableWidth, 22).fill("#eef2ff");
  let x = PAGE.margin + 10;
  doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(7);
  columns.forEach((column) => {
    const width = tableWidth * column.width - 12;
    doc.text(column.label.toUpperCase(), x, tableTop + 7, { width });
    x += tableWidth * column.width;
  });

  const feeRows = [
    [
      "Underwriting Fee",
      "—",
      data.underwritingFee,
      "Paid at Closing",
    ],
    [
      "Lender Origination Fee",
      data.lenderOriginationFeePercent,
      data.lenderOriginationFeeAmount,
      "Paid at Closing",
    ],
    ["Processing Fee", "—", data.processingFee || data.lenderFee, "Paid at Closing"],
    ["Exit Fee", data.exitFee || data.lenderCommitmentFee, "", ""],
    [
      "Broker Finders' Fee",
      data.brokerFindersFee,
      data.brokerFindersFeeAmount,
      "Paid at Closing",
    ],
    ["Legal Fee", "—", data.legalFee, data.legalAppraisalWhenDue || ""],
    ["Rate Buy-Down", "—", data.rateBuyDown, ""],
    ["Prepay Buy-Down", "—", data.prepayBuyDown, ""],
    ["Appraisal Cost", "—", data.appraisalCost, data.appraisalWhenDue || "At Cost"],
    [
      "Legal / Appraisal",
      "—",
      data.legalAppraisal,
      data.legalAppraisalWhenDue || "At Cost",
    ],
    ["Total Loan Costs", "—", data.totalLoanCosts, ""],
  ];

  let rowY = tableTop + 24;
  feeRows.forEach(([item, rate, amount, whenDue], index) => {
    const rowHeight = 24;
    if (index % 2 === 0) {
      doc.rect(PAGE.margin, rowY - 2, tableWidth, rowHeight).fill("#fafafa");
    }

    let cellX = PAGE.margin + 10;
    const values = [item, rate, amount, whenDue];
    columns.forEach((column, columnIndex) => {
      const width = tableWidth * column.width - 12;
      const text = display(values[columnIndex], columnIndex === 0 ? "" : "—");
      doc
        .font(columnIndex === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8)
        .fillColor("#334155")
        .text(text, cellX, rowY + 7, { width });
      cellX += tableWidth * column.width;
    });

    rowY += rowHeight;
  });

  doc
    .rect(PAGE.margin, tableTop, tableWidth, rowY - tableTop)
    .strokeColor(COLORS.border)
    .stroke();

  doc.y = rowY + 16;
}

function drawTags(doc, title, tags, bgColor, textColor) {
  ensureSpace(doc, 48);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text(title, PAGE.margin, doc.y);
  sectionGap(doc, 10);

  if (!tags || tags.length === 0) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9);
    doc.text("—", PAGE.margin, doc.y);
    sectionGap(doc, 14);
    return;
  }

  let x = PAGE.margin;
  let y = doc.y;
  const maxX = PAGE.width - PAGE.margin;

  tags.forEach((tag) => {
    const text = display(tag, "");
    if (!text) return;
    const tagWidth = doc.widthOfString(text, { font: "Helvetica", size: 8 }) + 20;

    if (x + tagWidth > maxX) {
      x = PAGE.margin;
      y += 26;
    }

    doc.roundedRect(x, y, tagWidth, 20, 9).fill(bgColor);
    doc.fillColor(textColor).font("Helvetica").fontSize(8);
    doc.text(text, x + 10, y + 6, { width: tagWidth - 16 });

    x += tagWidth + 10;
  });

  doc.y = y + 34;
}

function drawSpecialConditions(doc, data) {
  const conditions = Array.isArray(data.specialConditions)
    ? data.specialConditions.filter(Boolean)
    : [];
  if (conditions.length === 0) return;

  ensureSpace(doc, 40 + conditions.length * 16);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Special Conditions", PAGE.margin, doc.y);
  sectionGap(doc, 10);

  conditions.forEach((item) => {
    ensureSpace(doc, 18);
    const y = doc.y;
    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9);
    doc.text("•", PAGE.margin, y, { width: 12 });
    doc.fillColor("#334155").font("Helvetica").fontSize(8.5);
    doc.text(display(item), PAGE.margin + 12, y, {
      width: PAGE.width - PAGE.margin * 2 - 12,
    });
    doc.y = Math.max(doc.y, y + 16);
  });

  sectionGap(doc, 12);
}

function drawRequiredDocuments(doc, data) {
  ensureSpace(doc, 120);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Required Documents & Conditions", PAGE.margin, doc.y);
  sectionGap(doc, 10);

  const docs = data.requiredDocuments || [];
  const startY = doc.y;
  const colWidth = (PAGE.width - PAGE.margin * 2 - 20) / 2;

  docs.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE.margin + column * (colWidth + 20);
    const y = startY + row * 20;

    doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(9);
    doc.text("✓", x, y, { width: 12 });
    doc.fillColor("#334155").font("Helvetica").fontSize(8);
    doc.text(display(item), x + 14, y, { width: colWidth - 14 });
  });

  const rows = Math.ceil(docs.length / 2);
  doc.y = startY + rows * 20 + 14;

  doc.fillColor("#334155").font("Helvetica").fontSize(9);
  doc.text(
    `Funding Timeline: Approximately ${display(data.fundingTimelineDays, "30")} business days after complete application submission.`,
    PAGE.margin,
    doc.y,
    { width: PAGE.width - PAGE.margin * 2 },
  );

  if (data.expirationDate) {
    doc.moveDown(0.6);
    doc
      .font("Helvetica-Bold")
      .text(
        `Offer Valid Until: ${display(data.expirationDate)}`,
        PAGE.margin,
        doc.y,
        { width: PAGE.width - PAGE.margin * 2 },
      );
  }

  sectionGap(doc, 18);
}

function drawDisclaimer(doc, data) {
  ensureSpace(doc, 140);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Terms, Conditions & Disclaimer", PAGE.margin, doc.y);
  sectionGap(doc, 10);

  const boxY = doc.y;
  const boxHeight = 112;
  doc
    .roundedRect(PAGE.margin, boxY, PAGE.width - PAGE.margin * 2, boxHeight, 8)
    .fill(COLORS.disclaimerBg)
    .strokeColor(COLORS.border)
    .stroke();

  doc.fillColor("#475569").font("Helvetica").fontSize(7.5);
  doc.text(display(data.disclaimerText), PAGE.margin + 14, boxY + 12, {
    width: PAGE.width - PAGE.margin * 2 - 28,
    align: "justify",
    lineGap: 3,
  });

  doc.y = boxY + boxHeight + 20;
}

function drawSignatures(doc, data) {
  ensureSpace(doc, 130);
  doc.fillColor(COLORS.accent).font("Helvetica-Bold").fontSize(10);
  doc.text("Acknowledgement & Signatures", PAGE.margin, doc.y);
  sectionGap(doc, 12);

  const startY = doc.y;
  const colWidth = (PAGE.width - PAGE.margin * 2 - 24) / 3;
  const blocks = [
    ["Borrower Signature", data.signatureBorrowerName || data.applicantBorrower],
    ["Broker Signature", data.brokerName],
    ["Lender Signature", data.lenderName],
  ];

  blocks.forEach(([title, printName], index) => {
    const x = PAGE.margin + index * (colWidth + 12);
    doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(7);
    doc.text(title.toUpperCase(), x, startY, { width: colWidth });

    doc
      .moveTo(x, startY + 36)
      .lineTo(x + colWidth, startY + 36)
      .strokeColor("#cbd5e1")
      .stroke();

    doc.fillColor("#334155").font("Helvetica").fontSize(8);
    doc.text(`Print Name: ${display(printName, "")}`, x, startY + 44, {
      width: colWidth,
    });

    doc
      .moveTo(x, startY + 72)
      .lineTo(x + colWidth, startY + 72)
      .strokeColor("#cbd5e1")
      .stroke();
    doc.text("Date:", x, startY + 80, { width: colWidth });
  });

  doc.y = startY + 112;
}

function generateLoiPdf(loiData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: {
          top: PAGE.margin,
          bottom: PAGE.bottomSafe,
          left: PAGE.margin,
          right: PAGE.margin,
        },
        autoFirstPage: true,
      });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      doc.on("pageAdded", () => {
        doc.y = PAGE.margin;
      });

      drawHeader(doc, loiData);
      drawParties(doc, loiData);
      drawSummaryBox(doc, loiData);
      drawCalculatedMetrics(doc, loiData);
      drawLoanTerms(doc, loiData);
      drawFeesTable(doc, loiData);

      if (doc.y > PAGE.height - 300) {
        doc.addPage();
      }

      drawTags(
        doc,
        "Loan Purpose",
        loiData.loanPurposeTags,
        COLORS.purposeTag,
        COLORS.purposeText,
      );
      drawTags(
        doc,
        "Collateral",
        loiData.collateralTags,
        COLORS.collateralTag,
        COLORS.collateralText,
      );
      drawRequiredDocuments(doc, loiData);
      drawSpecialConditions(doc, loiData);

      if (doc.y > PAGE.height - 240) {
        doc.addPage();
      }

      drawDisclaimer(doc, loiData);
      drawSignatures(doc, loiData);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateLoiPdf };
