const { convertHtmlToPdf } = require("../utils/convertHtmlToPdf");

function sanitizeFilenamePart(value) {
  return String(value || "fee-agreement")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildFeeAgreementPdfFilename(agreement) {
  const base = sanitizeFilenamePart(
    agreement.clientEntityName ||
      agreement.clientName ||
      agreement.loanApplicationId ||
      "fee-agreement",
  );

  return `Fee-Agreement-${base}-signed.pdf`;
}

function toAbsoluteAssetUrl(url, apiBase) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${apiBase}${url}`;
  }
  return url;
}

function absolutizeAgreementHtmlImages(agreementHtml, apiBase) {
  if (!agreementHtml) return agreementHtml;

  return agreementHtml.replace(
    /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, prefix, src, suffix) => {
      const resolved = toAbsoluteAssetUrl(src, apiBase);
      return `${prefix}${resolved || src}${suffix}`;
    },
  );
}

function wrapAgreementHtmlDocument(agreementHtml, apiBase) {
  const body = absolutizeAgreementHtmlImages(agreementHtml, apiBase);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Fee Agreement</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.5;
        color: #111827;
        margin: 32px;
      }
      img {
        max-width: 220px;
        max-height: 96px;
        object-fit: contain;
      }
      h2, h3 {
        color: #111827;
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function isFeeAgreementSigned(agreement) {
  if (!agreement) return false;
  if (String(agreement.status || "").toUpperCase() === "SIGNED") return true;
  return Boolean(agreement.clientSignature && agreement.signedAt);
}

async function generateFeeAgreementPdfBuffer(agreement, { apiBase }) {
  if (!isFeeAgreementSigned(agreement)) {
    const error = new Error("Fee agreement is not signed yet");
    error.code = "NOT_SIGNED";
    throw error;
  }

  if (!agreement.agreementHtml?.trim()) {
    const error = new Error("Agreement HTML is missing");
    error.code = "MISSING_HTML";
    throw error;
  }

  const htmlDocument = wrapAgreementHtmlDocument(agreement.agreementHtml, apiBase);
  return convertHtmlToPdf(Buffer.from(htmlDocument, "utf-8"));
}

module.exports = {
  buildFeeAgreementPdfFilename,
  wrapAgreementHtmlDocument,
  isFeeAgreementSigned,
  generateFeeAgreementPdfBuffer,
};
