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
  ink: "#111111",
  body: "#222222",
  muted: "#555555",
  line: "#111111",
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

function drawAt(doc, text, x, y, options = {}) {
  const { lineBreak = false, ...rest } = options;
  doc.text(String(text ?? ""), x, y, { lineBreak, ...rest });
}

function ensureSpace(doc, y, blockHeight, gap = 8) {
  if (y + gap + blockHeight > LOI_CONTENT_BOTTOM) {
    doc.addPage();
    return Math.min(PAGE.margin, 28);
  }
  return y + gap;
}

const KV_LABEL_WIDTH = 210;

/** Simple label | value row with wrap-safe height. */
function drawKvRow(doc, y, label, value, options = {}) {
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const labelWidth = options.labelWidth || KV_LABEL_WIDTH;
  const valueWidth = contentWidth - labelWidth - 8;
  const fontSize = 9;
  const text = display(value);

  doc.font("Helvetica-Bold").fontSize(fontSize);
  const labelH = doc.heightOfString(String(label), {
    width: labelWidth - 4,
  });

  doc.font("Helvetica").fontSize(fontSize);
  const valueH = doc.heightOfString(text, { width: valueWidth });
  const rowH = Math.max(labelH, valueH, 12) + 6;

  y = ensureSpace(doc, y, rowH, 0);

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(fontSize);
  doc.text(String(label), PAGE.margin, y, {
    width: labelWidth - 4,
    lineBreak: true,
  });

  doc.fillColor(COLORS.body).font("Helvetica").fontSize(fontSize);
  doc.text(text, PAGE.margin + labelWidth + 8, y, {
    width: valueWidth,
    lineBreak: true,
  });

  return y + rowH;
}

/**
 * Bordered section with header bar + label/value rows.
 * Values are right-aligned like the sample term sheet.
 */
function drawBoxedTable(doc, startY, title, rows) {
  const usable = rows.filter(([, value]) => display(value, "") !== "—");
  if (!usable.length) return startY;

  const contentWidth = PAGE.width - PAGE.margin * 2;
  const labelWidth = contentWidth * 0.62;
  const valueWidth = contentWidth - labelWidth;
  const headerH = title ? 18 : 0;
  const rowH = 16;
  const padY = 6;
  const boxH = headerH + usable.length * rowH + padY * 2;

  let y = ensureSpace(doc, startY, boxH, 10);

  doc.rect(PAGE.margin, y, contentWidth, boxH).strokeColor(COLORS.line).lineWidth(1).stroke();

  if (title) {
    doc
      .moveTo(PAGE.margin, y + headerH)
      .lineTo(PAGE.margin + contentWidth, y + headerH)
      .strokeColor(COLORS.line)
      .lineWidth(1)
      .stroke();

    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10);
    drawAt(doc, title, PAGE.margin + 8, y + 5, { width: contentWidth - 16 });
  }

  let rowY = y + headerH + padY;
  usable.forEach(([label, value], index) => {
    if (index > 0) {
      doc
        .moveTo(PAGE.margin, rowY - 3)
        .lineTo(PAGE.margin + contentWidth, rowY - 3)
        .strokeColor(COLORS.line)
        .lineWidth(0.5)
        .stroke();
    }

    doc
      .moveTo(PAGE.margin + labelWidth, y + headerH)
      .lineTo(PAGE.margin + labelWidth, y + boxH)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke();

    doc.fillColor(COLORS.ink).font("Helvetica").fontSize(9);
    drawAt(doc, label, PAGE.margin + 8, rowY, { width: labelWidth - 16 });

    doc.font("Helvetica-Bold").fontSize(9);
    drawAt(doc, display(value), PAGE.margin + labelWidth + 6, rowY, {
      width: valueWidth - 14,
      align: "right",
    });

    rowY += rowH;
  });

  return y + boxH;
}

function drawHeader(doc, data) {
  const brandName = display(
    data.lenderBrandName || data.lenderName,
    "COMPANY NAME",
  );
  const logoBuffer = resolveLogoBuffer(data.lenderLogoUrl);
  // Tight top inset — avoid double-margin empty band
  let y = 28;

  const LOGO_W = 96;
  const LOGO_H = 32;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, PAGE.margin, y, { fit: [LOGO_W, LOGO_H] });
      y += LOGO_H + 6;
    } catch {
      /* ignore bad logo */
    }
  }

  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10);
  drawAt(doc, brandName, PAGE.margin, y, {
    width: PAGE.width - PAGE.margin * 2,
  });
  y += 16;

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(16);
  drawAt(doc, "Loan Term Sheet", PAGE.margin, y, {
    width: PAGE.width - PAGE.margin * 2,
    align: "center",
  });

  const titleWidth = doc.widthOfString("Loan Term Sheet");
  const titleX = (PAGE.width - titleWidth) / 2;
  doc
    .moveTo(titleX, y + 14)
    .lineTo(titleX + titleWidth, y + 14)
    .strokeColor(COLORS.ink)
    .lineWidth(1)
    .stroke();

  y += 20;
  const dateText = display(
    data.createdDate ||
      data.loiDate ||
      data.date ||
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
  );
  doc.fillColor(COLORS.body).font("Helvetica").fontSize(10);
  drawAt(doc, dateText, PAGE.margin, y, {
    width: PAGE.width - PAGE.margin * 2,
    align: "center",
  });

  return y + 16;
}

function drawPartyTerms(doc, startY, data) {
  let y = startY;

  const termParts = [display(data.term, ""), display(data.amortization || data.interestOnly === "Yes" ? "Interest Only" : "", "")]
    .filter((part) => part && part !== "—");

  const rows = [
    ["Borrower:", data.applicantBorrower || data.borrowerName || data.clientName],
    ["Principal / Guarantors:", data.guarantors],
    ["Property Address:", data.propertyAddress],
    ["Loan Program:", data.loanProductName || data.loanProductCode],
    ["Property Type:", data.propertyType],
    ["Broker:", data.brokerName],
    ["Term:", termParts.join(", ") || data.term],
    ["Assumability:", "Loan is NOT assumable."],
    [
      "Guarantor:",
      data.personalGuarantee === "Required" || data.personalGuarantee
        ? "Personal guarantee by the principal(s) of the Borrower"
        : data.personalGuarantee,
    ],
    [
      "Collateral:",
      (Array.isArray(data.collateralTags) && data.collateralTags.length
        ? data.collateralTags.join(", ")
        : data.collateral) ||
        `${data.valueFieldLabel || "Property"} collateral`,
    ],
    ["Pre-Payment Penalty:", data.prepaymentPenalty],
    ["Recourse:", data.recourse],
  ];

  rows.forEach(([label, value]) => {
    if (display(value, "") === "—") return;
    y = drawKvRow(doc, y, label, value, { labelWidth: KV_LABEL_WIDTH });
  });

  return y + 8;
}

function drawConditionalNote(doc, startY, data) {
  const note =
    data.disclaimerText ||
    "PLEASE NOTE: The Following Terms are conditional and subject to appraised value, verification of funds, borrower experience and credit approval. Terms may be subject to change at the lender's discretion.";

  const contentWidth = PAGE.width - PAGE.margin * 2;
  doc.fillColor(COLORS.body).font("Helvetica-Oblique").fontSize(8);
  const height = doc.heightOfString(note, { width: contentWidth });
  let y = ensureSpace(doc, startY, height + 8, 6);
  doc.text(note, PAGE.margin, y, { width: contentWidth, align: "left" });
  return y + height + 10;
}

function drawRateAndPayment(doc, startY, data) {
  return drawBoxedTable(doc, startY, "Rate & Payment", [
    ["RATE:", data.interestRate],
    [
      "Total Loan Amount:",
      data.totalFinancedLoanAmount ||
        data.approvedAmount ||
        data.loanRequest ||
        data.baseLoanAmount,
    ],
    ["Payment (Interest):", data.monthlyPayment],
    [
      "Required Reserves:",
      display(data.requiredReservesAmount, "") !== "—"
        ? data.requiredReservesAmount
        : "",
    ],
    ["Monthly Payment:", data.monthlyPayment],
  ]);
}

function drawLoanAmountSection(doc, startY, data) {
  const valueLabel = data.valueFieldLabel || "Property Value";
  const rows = [
    [`${valueLabel} As Is:`, data.collateralOrPropertyValue || data.propertyValue],
    [
      "Initial Loan Amount:",
      data.baseLoanAmount ||
        data.requestedLoanAmount ||
        data.approvedAmount ||
        data.loanAmountRequested,
    ],
    ["Market LTV:", data.ltvRatio || data.ltvPercentage],
  ];

  if (display(data.rehabConstructionCost, "") !== "—") {
    rows.push(
      ["Rehab/Construction Cost:", data.rehabConstructionCost],
      ["Market LTC:", data.ltcRatio || data.ltcPercentage],
      [
        "Total Project Cost (As-Is Value + Rehab/Const Cost):",
        data.projectCost,
      ],
    );
  }

  if (display(data.maximumLtvPercent, "") !== "—") {
    rows.push(["Maximum LTV:", data.maximumLtvPercent]);
  }
  if (display(data.maximumLtcPercent, "") !== "—") {
    rows.push(["Maximum LTC:", data.maximumLtcPercent]);
  }

  return drawBoxedTable(doc, startY, "LOAN AMOUNT", rows);
}

function drawArvSection(doc, startY, data) {
  if (
    display(data.afterRepairValue, "") === "—" &&
    display(data.arvRatio || data.arvPercentage, "") === "—"
  ) {
    return startY;
  }

  return drawBoxedTable(doc, startY, "AFTER REPAIR VALUE (ARV)", [
    ["ARV %:", data.arvRatio || data.arvPercentage],
    ["After-Repair Value:", data.afterRepairValue],
    ...(display(data.maximumArvPercent, "") !== "—"
      ? [["Maximum ARV:", data.maximumArvPercent]]
      : []),
  ]);
}

function drawFeesSection(doc, startY, data) {
  const rows = [
    [
      "Origination Points:",
      data.originationFeeAmount || data.lenderOriginationFeeAmount,
    ],
    ["Broker Points:", data.brokerFindersFeeAmount || data.brokerFindersFee],
    ["Appraisal Fee:", data.appraisalFeeAmount || data.appraisalCost || data.appraisalFee],
    ["Processing Fees:", data.processingFeeAmount || data.processingFee],
    ["Wire Fee:", data.wireFeeAmount || data.wireFee],
    ["Underwriting Fee:", data.underwritingFeeAmount || data.underwritingFee],
    ["Total Closing Costs:", data.totalClosingCosts || data.totalLoanCosts],
  ];

  return drawBoxedTable(doc, startY, "Estimated Fees & Costs", rows);
}

function drawReservesSection(doc, startY, data) {
  if (
    display(data.requiredReservesPercent, "") === "—" &&
    display(data.requiredReservesAmount, "") === "—"
  ) {
    return startY;
  }

  const pct = display(data.requiredReservesPercent, "");
  const label =
    pct !== "—"
      ? `${pct} Contingency Reserve`
      : "Contingency Reserve";

  return drawBoxedTable(doc, startY, "REQUIRED RESERVES", [
    [label, data.requiredReservesAmount],
    ["Total Required Reserves", data.requiredReservesAmount],
  ]);
}

function drawAdditionalRequirements(doc, startY, data) {
  const docs = Array.isArray(data.requiredDocuments)
    ? data.requiredDocuments.filter(Boolean)
    : [];
  const special = Array.isArray(data.specialConditions)
    ? data.specialConditions.filter(Boolean)
    : [];

  if (!docs.length && !special.length) return startY;

  let y = ensureSpace(doc, startY, 40, 14);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11);
  drawAt(
    doc,
    "Additional Terms & Requirements for Loan Processing & Underwriting",
    PAGE.margin,
    y,
    { width: PAGE.width - PAGE.margin * 2 },
  );
  y += 18;

  const items = [...docs, ...special];
  items.forEach((item, index) => {
    const line = `${index + 1}. ${item}`;
    const h = doc.heightOfString(line, {
      width: PAGE.width - PAGE.margin * 2,
    });
    y = ensureSpace(doc, y, h + 4, 0);
    doc.fillColor(COLORS.body).font("Helvetica").fontSize(9);
    doc.text(line, PAGE.margin, y, {
      width: PAGE.width - PAGE.margin * 2,
    });
    y += h + 4;
  });

  return y + 6;
}

function drawBorrowerSignatureBlock(doc, startY, data) {
  const boxWidth = PAGE.width - PAGE.margin * 2;
  const padding = 8;
  const titleH = 14;
  const disclaimer =
    "By signing below, the borrower acknowledges receipt of these proposed terms and understands this document is not a final loan commitment.";

  doc.font("Helvetica").fontSize(8);
  const disclaimerH = Math.max(
    12,
    doc.heightOfString(disclaimer, { width: boxWidth - 16 }),
  );

  const sigImageH = 36;
  const lineGap = 4;
  const footerH = 16;
  const boxHeight =
    padding +
    titleH +
    4 +
    disclaimerH +
    8 +
    sigImageH +
    lineGap +
    footerH +
    padding;

  let y = ensureSpace(doc, startY, boxHeight, 14);
  const boxTop = y;

  doc
    .rect(PAGE.margin, y, boxWidth, boxHeight)
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .stroke();

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10);
  drawAt(doc, "Borrower Acknowledgement", PAGE.margin + 8, y + padding, {
    width: boxWidth - 16,
  });

  const disclaimerY = y + padding + titleH + 4;
  doc.fillColor(COLORS.body).font("Helvetica").fontSize(8);
  drawAt(doc, disclaimer, PAGE.margin + 8, disclaimerY, {
    width: boxWidth - 16,
  });

  const sigTopY = disclaimerY + disclaimerH + 8;
  const sigWidth = Math.min(220, boxWidth * 0.45);
  const sigX = PAGE.margin + 10;
  const lineY = sigTopY + sigImageH + 2;

  // Light guide for the unsigned signature area (client signature is merged later).
  doc
    .moveTo(PAGE.margin + 8, lineY)
    .lineTo(PAGE.margin + boxWidth - 8, lineY)
    .strokeColor(COLORS.ink)
    .lineWidth(0.75)
    .stroke();

  const printNameY = lineY + 6;
  const dateX = PAGE.margin + boxWidth * 0.58;

  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8);
  drawAt(
    doc,
    `Print Name: ${display(data.signatureBorrowerName || data.applicantBorrower, "")}`,
    PAGE.margin + 8,
    printNameY,
    { width: boxWidth * 0.52 },
  );
  drawAt(doc, "Date: ____________________", dateX, printNameY, {
    width: boxWidth * 0.38,
  });

  const anchor = buildLoiSignatureAnchor(doc, {
    boxTop,
    boxWidth,
    lineY,
    sigX,
    sigTopY,
    sigWidth,
    sigHeight: sigImageH,
    dateX,
    printNameY,
  });

  return { endY: boxTop + boxHeight + 4, anchor };
}

function generateLoiPdf(loiData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: {
          top: 28,
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

      let y = drawHeader(doc, loiData);
      y = drawPartyTerms(doc, y, loiData);
      y = drawConditionalNote(doc, y, loiData);
      y = drawRateAndPayment(doc, y, loiData);
      y = drawLoanAmountSection(doc, y, loiData);
      y = drawArvSection(doc, y, loiData);
      y = drawFeesSection(doc, y, loiData);
      y = drawReservesSection(doc, y, loiData);
      y = drawAdditionalRequirements(doc, y, loiData);

      const signatureResult = drawBorrowerSignatureBlock(doc, y, loiData);

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

module.exports = {
  generateLoiPdf,
};
