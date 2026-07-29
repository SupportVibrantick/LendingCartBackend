const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const {
  LOI_PAGE,
  LOI_CONTENT_BOTTOM,
  buildLoiSignatureAnchor,
} = require("./loiPdfLayout");

const PAGE = LOI_PAGE;

const COLORS = {
  primary: "#0F766E",
  primaryDark: "#134E4A",
  accent: "#14B8A6",
  ink: "#0F172A",
  body: "#334155",
  label: "#64748B",
  border: "#E2E8F0",
  panel: "#F8FAFC",
  panelAlt: "#F0FDFA",
  white: "#FFFFFF",
};

const display = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value).trim();
  if (!text || text === "0" || text === "$0" || text === "0%") return fallback;
  return text;
};

function resolveLogoBuffer(logoUrl) {
  if (!logoUrl) return null;
  try {
    if (String(logoUrl).startsWith("data:")) {
      const base64 = String(logoUrl).split(",")[1];
      return base64 ? Buffer.from(base64, "base64") : null;
    }
    const filePath = path.join(
      process.cwd(),
      "public",
      String(logoUrl).replace(/^\/+/, ""),
    );
    return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  } catch {
    return null;
  }
}

/** Draw text at fixed coordinates without letting PDFKit advance doc.y */
function drawAt(doc, text, x, y, options = {}) {
  doc.text(String(text ?? ""), x, y, { lineBreak: false, ...options });
}

function drawCell(doc, x, y, width, label, value, valueSize = 9) {
  doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(6.5);
  drawAt(doc, String(label).toUpperCase(), x, y, { width });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(valueSize);
  drawAt(doc, display(value), x, y + 9, { width });
}

function drawSectionHeading(doc, y, title) {
  doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(9);
  drawAt(doc, title.toUpperCase(), PAGE.margin, y, {
    width: PAGE.width - PAGE.margin * 2,
  });
  doc
    .moveTo(PAGE.margin, y + 12)
    .lineTo(PAGE.width - PAGE.margin, y + 12)
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .stroke();
  return y + 17;
}

function drawGrid(doc, startY, rows, columns, rowHeight = 28, gap = 12) {
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const colWidth = (contentWidth - gap * (columns - 1)) / columns;

  rows.forEach(([label, value], index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = PAGE.margin + col * (colWidth + gap);
    const y = startY + row * rowHeight;
    doc.fillColor(COLORS.label);
    drawCell(doc, x, y, colWidth, label, value, 8.5);
  });

  return startY + Math.ceil(rows.length / columns) * rowHeight + 4;
}

function drawHeader(doc, data) {
  const headerHeight = 80;
  doc.rect(0, 0, PAGE.width, headerHeight).fill(COLORS.primaryDark);

  const brandName = display(data.lenderBrandName || data.lenderName, "Lender");
  const logoBuffer = resolveLogoBuffer(data.lenderLogoUrl);

  const LOGO_W = 96;
  const LOGO_H = 28;
  const brandFontSize = 10;
  const brandGap = 4;
  const metaX = PAGE.width - PAGE.margin - 150;
  const brandMaxWidth = Math.max(140, metaX - PAGE.margin - 12);

  if (logoBuffer) {
    try {
      const blockHeight = LOGO_H + brandGap + brandFontSize;
      const blockTop = (headerHeight - blockHeight) / 2;
      const logoY = blockTop;

      doc.image(logoBuffer, PAGE.margin, logoY, { fit: [LOGO_W, LOGO_H] });

      doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(brandFontSize);
      drawAt(doc, brandName, PAGE.margin, logoY + LOGO_H + brandGap, {
        width: brandMaxWidth,
      });
    } catch {
      doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(brandFontSize);
      drawAt(doc, brandName, PAGE.margin, (headerHeight - brandFontSize) / 2, {
        width: brandMaxWidth,
      });
    }
  } else {
    doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(11);
    drawAt(doc, brandName, PAGE.margin, (headerHeight - 11) / 2, {
      width: brandMaxWidth,
    });
  }

  doc.font("Helvetica").fontSize(7.5).fillColor("#E2E8F0");
  drawAt(doc, `Loan # ${display(data.applicationNumber, "N/A")}`, metaX, 16, {
    width: 150,
    align: "right",
  });
  drawAt(doc, `Date: ${display(data.date, "")}`, metaX, 28, {
    width: 150,
    align: "right",
  });
  if (data.expirationDate) {
    drawAt(doc, `Valid Until: ${display(data.expirationDate)}`, metaX, 40, {
      width: 150,
      align: "right",
    });
  }

  return headerHeight + 10;
}

function drawTitleBlock(doc, startY) {
  let y = startY;
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(16);
  drawAt(doc, "Letter of Intent / Term Sheet", PAGE.margin, y, {
    width: PAGE.width - PAGE.margin * 2,
    align: "center",
  });
  y += 20;

  doc.fillColor(COLORS.label).font("Helvetica").fontSize(8);
  drawAt(
    doc,
    "Conditional proposal subject to final underwriting, documentation, and credit approval.",
    PAGE.margin,
    y,
    { width: PAGE.width - PAGE.margin * 2, align: "center" },
  );
  y += 18;

  doc
    .roundedRect(PAGE.margin + 40, y, PAGE.width - PAGE.margin * 2 - 80, 16, 4)
    .fill(COLORS.panelAlt)
    .strokeColor(COLORS.accent)
    .lineWidth(0.5)
    .stroke();
  doc.fillColor(COLORS.primaryDark).font("Helvetica-Bold").fontSize(7);
  drawAt(
    doc,
    "FOR DISCUSSION PURPOSES ONLY — NOT A COMMITMENT TO LEND",
    PAGE.margin,
    y + 4,
    { width: PAGE.width - PAGE.margin * 2, align: "center" },
  );

  return y + 22;
}

function drawProposedTermsBox(doc, startY, data) {
  let y = drawSectionHeading(doc, startY, "Proposed Loan Terms");
  const boxY = y;
  const boxWidth = PAGE.width - PAGE.margin * 2;
  const boxHeight = 66;

  doc.roundedRect(PAGE.margin, boxY, boxWidth, boxHeight, 8).fill(COLORS.panelAlt);
  doc
    .roundedRect(PAGE.margin, boxY, boxWidth, boxHeight, 8)
    .strokeColor(COLORS.accent)
    .lineWidth(0.75)
    .stroke();

  const items = [
    [
      "Total Financed Loan Amount",
      data.totalFinancedLoanAmount || data.loanRequest || data.approvedAmount,
    ],
    ["Interest Rate", data.interestRate],
    ["LTV", data.ltvRatio],
    ["LTC", data.ltcRatio],
    ["ARV", data.arvRatio || data.arvPercentage],
    ["Monthly Payment", data.monthlyPayment],
    ["Interest Only", data.interestOnly || "No"],
    ["Term", data.term],
  ];

  const colWidth = boxWidth / 4;
  items.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = PAGE.margin + col * colWidth + 10;
    const cellY = boxY + 8 + row * 28;
    doc.fillColor(COLORS.label);
    drawCell(doc, x, cellY, colWidth - 14, label, value, 10);
  });

  return boxY + boxHeight + 6;
}

function drawFinancedFeesBreakdown(doc, startY, data) {
  const rows = [
    [
      "Requested Loan Amount",
      data.requestedLoanAmount || data.baseLoanAmount || data.loanAmountRequested,
    ],
  ];

  if (display(data.originationFeeAmount, "") !== "—") {
    rows.push([
      data.originationFeeLabel || "Origination Fee",
      data.originationFeeAmount || data.lenderOriginationFeeAmount,
    ]);
  }

  if (display(data.processingFeeAmount, "") !== "—") {
    rows.push(["Processing Fee", data.processingFeeAmount || data.processingFee]);
  }

  if (display(data.underwritingFeeAmount, "") !== "—") {
    rows.push([
      "Underwriting Fee",
      data.underwritingFeeAmount || data.underwritingFee,
    ]);
  }

  const total =
    data.totalFinancedLoanAmount || data.loanRequest || data.approvedAmount;
  if (rows.length <= 1 || display(total, "") === "—") {
    return startY;
  }

  let y = drawSectionHeading(doc, startY, "Loan Amount Breakdown");
  const boxWidth = PAGE.width - PAGE.margin * 2;
  const rowHeight = 16;
  const boxHeight = rows.length * rowHeight + 34;
  const boxY = y;

  doc.roundedRect(PAGE.margin, boxY, boxWidth, boxHeight, 8).fill(COLORS.panel);
  doc
    .roundedRect(PAGE.margin, boxY, boxWidth, boxHeight, 8)
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .stroke();

  let rowY = boxY + 10;
  rows.forEach(([label, value]) => {
    doc.fillColor(COLORS.body).font("Helvetica").fontSize(8.5);
    drawAt(doc, label, PAGE.margin + 14, rowY, { width: boxWidth * 0.62 });
    doc.font("Helvetica-Bold").fillColor(COLORS.ink);
    drawAt(doc, display(value), PAGE.margin + boxWidth * 0.58, rowY, {
      width: boxWidth * 0.34,
      align: "right",
    });
    rowY += rowHeight;
  });

  const dividerY = rowY + 2;
  doc
    .moveTo(PAGE.margin + 12, dividerY)
    .lineTo(PAGE.margin + boxWidth - 12, dividerY)
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .stroke();

  rowY = dividerY + 8;
  doc.fillColor(COLORS.primaryDark).font("Helvetica-Bold").fontSize(9);
  drawAt(doc, "Total Financed Loan Amount", PAGE.margin + 14, rowY, {
    width: boxWidth * 0.62,
  });
  drawAt(doc, display(total), PAGE.margin + boxWidth * 0.58, rowY, {
    width: boxWidth * 0.34,
    align: "right",
  });

  return boxY + boxHeight + 6;
}

function wrapTextLines(doc, text, maxWidth, fontSize) {
  doc.font("Helvetica").fontSize(fontSize);
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (doc.widthOfString(candidate) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawChecklist(doc, startY, items, options = {}) {
  const {
    x = PAGE.margin,
    width = PAGE.width - PAGE.margin * 2,
    lineHeight = 13,
    fontSize = 9,
  } = options;

  let y = startY;
  doc.fillColor(COLORS.body).font("Helvetica").fontSize(fontSize);

  items.forEach((item) => {
    const label = display(item, "");
    if (!label || label === "—") return;

    doc.fillColor(COLORS.primary).font("Helvetica-Bold").fontSize(fontSize);
    drawAt(doc, "✔", x, y, { width: 12 });
    doc.fillColor(COLORS.body).font("Helvetica").fontSize(fontSize);
    drawAt(doc, label, x + 16, y - 0.5, { width: width - 16 });
    y += lineHeight;
  });

  return y;
}

function estimateConditionsHeight(data) {
  const docs = data.requiredDocuments || [];
  const special = Array.isArray(data.specialConditions)
    ? data.specialConditions.filter(Boolean)
    : [];
  if (docs.length === 0 && special.length === 0) return 0;

  let height = 20;
  if (docs.length > 0) height += 10 + docs.length * 13;
  if (special.length > 0) height += 10 + special.length * 13;
  return height + 6;
}

function estimateDisclaimerHeight(doc, text, boxWidth) {
  const fontSize = 7.5;
  const lineHeight = 9.5;
  const lines = wrapTextLines(doc, text, boxWidth - 24, fontSize);
  const boxHeight = Math.max(44, 12 + lines.length * lineHeight);
  return 17 + boxHeight + 6;
}

function estimateSignatureHeight() {
  return 17 + 54 + 4;
}

function estimateBrandingFooterHeight(data) {
  const brandName = display(data.lenderBrandName || data.lenderName, "");
  const website = display(data.lenderWebsite, "");
  const email = display(data.lenderContactEmail, "");
  const phone = display(data.lenderContactPhone, "");
  const address = display(data.lenderAddress, "");
  const lines = [brandName, website, email, phone, address].filter(
    (line) => line && line !== "—",
  );
  if (lines.length === 0) return 0;
  return 10 + 14 + (lines.length - 1) * 11 + 8;
}

function ensureSpace(doc, y, blockHeight, gap = 2, maxY = LOI_CONTENT_BOTTOM) {
  if (y + gap + blockHeight > maxY) {
    doc.addPage();
    return PAGE.margin;
  }
  return y + gap;
}

function drawConditionsBlock(doc, startY, data) {
  const docs = data.requiredDocuments || [];
  const special = Array.isArray(data.specialConditions)
    ? data.specialConditions.filter(Boolean)
    : [];

  if (docs.length === 0 && special.length === 0) return startY;

  let y = drawSectionHeading(doc, startY, "Conditions & Requirements");

  if (docs.length > 0) {
    doc.fillColor(COLORS.body).font("Helvetica-Bold").fontSize(8.5);
    drawAt(doc, "Closing Conditions:", PAGE.margin, y, { width: 200 });
    y += 12;
    y = drawChecklist(doc, y, docs, { lineHeight: 13, fontSize: 9 });
    y += 2;
  }

  if (special.length > 0) {
    doc.fillColor(COLORS.body).font("Helvetica-Bold").fontSize(8.5);
    drawAt(doc, "Special Conditions:", PAGE.margin, y, { width: 200 });
    y += 12;
    y = drawChecklist(doc, y, special, { lineHeight: 13, fontSize: 9 });
    y += 4;
  }

  return y + 2;
}

function drawDisclaimerBlock(doc, startY, data) {
  let y = drawSectionHeading(doc, startY, "Disclaimer");
  const boxWidth = PAGE.width - PAGE.margin * 2;
  const text = display(data.disclaimerText);
  const fontSize = 7.5;
  const lineHeight = 9.5;
  const lines = wrapTextLines(doc, text, boxWidth - 24, fontSize);
  const boxHeight = Math.max(44, 12 + lines.length * lineHeight);

  doc
    .roundedRect(PAGE.margin, y, boxWidth, boxHeight, 6)
    .fill(COLORS.panel)
    .strokeColor(COLORS.border)
    .stroke();

  doc.fillColor(COLORS.body).font("Helvetica").fontSize(fontSize);
  let lineY = y + 8;
  lines.forEach((line) => {
    drawAt(doc, line, PAGE.margin + 12, lineY, { width: boxWidth - 24 });
    lineY += lineHeight;
  });

  return y + boxHeight + 6;
}

function drawBrandingFooter(doc, contentEndY, data) {
  const brandName = display(data.lenderBrandName || data.lenderName, "");
  const website = display(data.lenderWebsite, "");
  const email = display(data.lenderContactEmail, "");
  const phone = display(data.lenderContactPhone, "");
  const address = display(data.lenderAddress, "");

  const lines = [brandName, website, email, phone, address].filter(
    (line) => line && line !== "—",
  );

  if (lines.length === 0) return contentEndY;

  const boxWidth = PAGE.width - PAGE.margin * 2;
  const footerHeight = estimateBrandingFooterHeight(data);
  const pinnedY = LOI_CONTENT_BOTTOM - footerHeight;
  const gapToPin = pinnedY - contentEndY;
  let y;

  if (gapToPin >= 0 && gapToPin <= 80) {
    y = pinnedY;
  } else if (contentEndY + 12 + footerHeight <= LOI_CONTENT_BOTTOM) {
    y = contentEndY + 12;
  } else {
    doc.addPage();
    y = LOI_CONTENT_BOTTOM - footerHeight;
  }

  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.margin + boxWidth, y)
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .stroke();

  y += 10;
  doc.fillColor(COLORS.primaryDark).font("Helvetica-Bold").fontSize(9);
  drawAt(doc, lines[0], PAGE.margin, y, {
    width: boxWidth,
    align: "center",
  });
  y += 14;

  doc.fillColor(COLORS.label).font("Helvetica").fontSize(8);
  lines.slice(1).forEach((line) => {
    drawAt(doc, line, PAGE.margin, y, { width: boxWidth, align: "center" });
    y += 11;
  });

  return y + 4;
}

function drawBorrowerSignatureBlock(doc, startY, data) {
  let y = drawSectionHeading(doc, startY, "Borrower Acknowledgement");
  const boxWidth = PAGE.width - PAGE.margin * 2;
  const boxHeight = 54;
  const boxTop = y;

  doc.roundedRect(PAGE.margin, y, boxWidth, boxHeight, 8).fill(COLORS.white);
  doc
    .roundedRect(PAGE.margin, y, boxWidth, boxHeight, 8)
    .strokeColor(COLORS.border)
    .stroke();

  drawAt(
    doc,
    "By signing below, the borrower acknowledges receipt of these proposed terms and understands this document is not a final loan commitment.",
    PAGE.margin + 12,
    y + 8,
    { width: boxWidth - 24 },
  );

  const lineY = y + 32;
  doc
    .moveTo(PAGE.margin + 12, lineY)
    .lineTo(PAGE.margin + boxWidth - 12, lineY)
    .strokeColor(COLORS.ink)
    .lineWidth(0.75)
    .stroke();

  doc.fillColor(COLORS.label).font("Helvetica-Bold").fontSize(6.5);
  drawAt(doc, "BORROWER SIGNATURE", PAGE.margin + 12, lineY + 6, {
    width: boxWidth - 24,
  });
  doc.fillColor(COLORS.ink).font("Helvetica").fontSize(8);
  drawAt(
    doc,
    `Print Name: ${display(data.signatureBorrowerName || data.applicantBorrower, "")}`,
    PAGE.margin + 12,
    lineY + 16,
    { width: boxWidth * 0.58 },
  );
  drawAt(
    doc,
    "Date: ____________________",
    PAGE.margin + 12 + boxWidth * 0.58,
    lineY + 16,
    { width: boxWidth * 0.34 },
  );

  const anchor = buildLoiSignatureAnchor(doc, boxTop, boxWidth, lineY);

  return {
    endY: y + boxHeight + 4,
    anchor,
  };
}

function generateLoiPdf(loiData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: {
          top: PAGE.margin,
          bottom: PAGE.bottom,
          left: PAGE.margin,
          right: PAGE.margin,
        },
        autoFirstPage: true,
      });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // ── PAGE 1 ──────────────────────────────────────────────
      let y = drawHeader(doc, loiData);
      y = drawTitleBlock(doc, y);

      y = drawSectionHeading(doc, y, "Application Overview");
      const overviewRows = [
        ["Borrower", loiData.applicantBorrower || loiData.borrowerName],
        ["Property Address", loiData.propertyAddress],
        ["Property Type", loiData.propertyType],
        ["Loan Product", loiData.loanProductName || loiData.loanProductCode],
        ...(loiData.fundingLenderName
          ? [["Funding Lender", loiData.fundingLenderName]]
          : []),
        ["Broker", loiData.brokerName],
        ["Guarantors", loiData.guarantors],
        [
          "Requested Loan Amount",
          loiData.requestedLoanAmount ||
            loiData.baseLoanAmount ||
            loiData.loanAmountRequested ||
            loiData.amountRequested,
        ],
        ["Property Value", loiData.propertyValue],
        ["Project Cost", loiData.projectCost],
      ];
      y = drawGrid(doc, y, overviewRows, 3, 24, 10);

      y = drawFinancedFeesBreakdown(doc, y + 2, loiData);

      y = drawProposedTermsBox(doc, y + 2, loiData);

      y = drawSectionHeading(doc, y + 2, "Additional Terms");
      y = drawGrid(
        doc,
        y,
        [
          ["Amortization", loiData.amortization],
          ["Payment Frequency", loiData.paymentFrequency],
          ["Prepayment Penalty", loiData.prepaymentPenalty],
          ["Personal Guarantee", loiData.personalGuarantee],
          ["Recourse", loiData.recourse],
        ],
        4,
        22,
        8,
      );

      const boxWidth = PAGE.width - PAGE.margin * 2;
      const conditionsH = estimateConditionsHeight(loiData);
      const disclaimerH = estimateDisclaimerHeight(
        doc,
        display(loiData.disclaimerText),
        boxWidth,
      );
      const signatureH = estimateSignatureHeight();

      if (conditionsH > 0) {
        y = ensureSpace(doc, y, conditionsH);
        y = drawConditionsBlock(doc, y, loiData);
      }

      y = ensureSpace(doc, y, disclaimerH);
      y = drawDisclaimerBlock(doc, y, loiData);

      y = ensureSpace(doc, y, signatureH);
      const signatureResult = drawBorrowerSignatureBlock(doc, y, loiData);
      y = signatureResult.endY;

      drawBrandingFooter(doc, y, loiData);

      if (signatureResult.anchor) {
        doc.info = {
          ...(doc.info || {}),
          Keywords: JSON.stringify({ loiSigAnchor: signatureResult.anchor }),
        };
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateLoiPdf };
