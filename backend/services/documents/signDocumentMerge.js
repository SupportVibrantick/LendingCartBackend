const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const sharp = require("sharp");
const {
  estimateLoiSignatureAnchor,
  pdfKitYToPdfLibY,
} = require("../loi/loiPdfLayout");

function readLoiSigAnchor(pdfDoc, pageWidth, pageHeight) {
  try {
    const keywords = pdfDoc.getKeywords();
    if (keywords) {
      const parsed = JSON.parse(keywords);
      if (parsed.loiSigAnchor) {
        return parsed.loiSigAnchor;
      }
    }
  } catch {
    // Fall back to layout estimate for older LOI PDFs.
  }

  return estimateLoiSignatureAnchor(pageHeight, pageWidth);
}

function resolveLoiSignaturePage(pages, anchor) {
  if (anchor.page >= 0 && anchor.page < pages.length) {
    return pages[anchor.page];
  }
  return pages[pages.length - 1];
}

function drawLoiClientSignature(page, pngImage, font, anchor, pageHeight, options) {
  const sigWidth = Math.min(190, Math.round(anchor.boxWidth * 0.48));
  const sigHeight = 20;
  const sigX = anchor.margin + 12;
  const linePdfLibY = pdfKitYToPdfLibY(pageHeight, anchor.lineY);
  // Place signature above the line (pdf-lib Y grows upward).
  const sigY = linePdfLibY + 3;

  page.drawImage(pngImage, {
    x: sigX,
    y: sigY,
    width: sigWidth,
    height: sigHeight,
  });

  const signedDate = options.signedAt
    ? new Date(options.signedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const dateX = anchor.dateX;
  const dateY = pdfKitYToPdfLibY(pageHeight, anchor.printNameY) - 2;

  page.drawRectangle({
    x: dateX - 2,
    y: dateY - 3,
    width: anchor.boxWidth * 0.34,
    height: 11,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Date: ${signedDate}`, {
    x: dateX,
    y: dateY,
    size: 8,
    font,
    color: rgb(0.06, 0.09, 0.17),
  });
}

function decodeSignatureDataUrl(signature) {
  if (!signature || typeof signature !== "string") {
    throw new Error("Signature is required");
  }

  const match = signature.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid signature format. Expected PNG data URL.");
  }

  return Buffer.from(match[1], "base64");
}

function resolveDiskPathFromPublicUrl(fileUrl) {
  const relative = String(fileUrl || "").replace(/^\/+/, "");
  const publicCandidate = path.join(process.cwd(), "public", relative);
  if (fs.existsSync(publicCandidate)) {
    return publicCandidate;
  }
  return path.join(process.cwd(), relative);
}

async function mergeSignatureOntoPdf(pdfPath, signatureBuffer, options = {}) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pngImage = await pdfDoc.embedPng(signatureBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const isLoiTemplate = Boolean(options.isLoiTemplate);

  if (isLoiTemplate) {
    const fallbackPage = pages[pages.length - 1];
    const { width: fallbackWidth, height: fallbackHeight } =
      fallbackPage.getSize();
    const anchor = readLoiSigAnchor(pdfDoc, fallbackWidth, fallbackHeight);
    const signaturePage = resolveLoiSignaturePage(pages, anchor);
    const { height } = signaturePage.getSize();

    drawLoiClientSignature(signaturePage, pngImage, font, anchor, height, {
      signedAt: options.signedAt,
    });

    return Buffer.from(await pdfDoc.save());
  }

  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();
  const sigWidth = 180;
  const sigHeight = 70;
  const sigX = Math.max(24, width - sigWidth - 36);
  const sigY = 36;

  lastPage.drawImage(pngImage, {
    x: sigX,
    y: sigY,
    width: sigWidth,
    height: sigHeight,
  });

  return Buffer.from(await pdfDoc.save());
}

async function mergeSignatureOntoImage(imagePath, signatureBuffer, mimeType) {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;
  const sigWidth = Math.min(220, Math.floor(width * 0.35));
  const sigHeight = Math.max(60, Math.floor(sigWidth * 0.35));
  const resizedSig = await sharp(signatureBuffer)
    .resize(sigWidth, sigHeight)
    .png()
    .toBuffer();

  const left = Math.max(12, width - sigWidth - 24);
  const top = Math.max(12, height - sigHeight - 24);

  const output = image.composite([{ input: resizedSig, left, top }]);

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return output.jpeg({ quality: 92 }).toBuffer();
  }

  if (mimeType === "image/webp") {
    return output.webp({ quality: 92 }).toBuffer();
  }

  return output.png().toBuffer();
}

async function createSignedDocumentFile({
  templateFileUrl,
  templateMimeType,
  templateFileName,
  signature,
  outputDir,
  outputBaseName,
  signerName,
  signedAt,
}) {
  const signatureBuffer = decodeSignatureDataUrl(signature);
  const templatePath = resolveDiskPathFromPublicUrl(templateFileUrl);

  if (!fs.existsSync(templatePath)) {
    throw new Error("Template file not found on server");
  }

  const mime = (templateMimeType || "").toLowerCase();
  let outputBuffer;
  let outputMime = templateMimeType;
  let extension = path.extname(templateFileName || templatePath) || ".pdf";
  const isLoiTemplate = /\/(broker|lender)\/LOI\//i.test(
    String(templateFileUrl || ""),
  );

  if (mime === "application/pdf" || extension.toLowerCase() === ".pdf") {
    outputBuffer = await mergeSignatureOntoPdf(templatePath, signatureBuffer, {
      isLoiTemplate,
      signerName,
      signedAt: signedAt || new Date(),
    });
    outputMime = "application/pdf";
    extension = ".pdf";
  } else if (mime.startsWith("image/")) {
    outputBuffer = await mergeSignatureOntoImage(
      templatePath,
      signatureBuffer,
      mime,
    );
    outputMime = mime || "image/png";
  } else {
    throw new Error("Unsupported template type. Use PDF or image.");
  }

  await fs.promises.mkdir(outputDir, { recursive: true });
  const safeBase = isLoiTemplate
    ? `${outputBaseName}-signed-loi${extension}`
    : `${outputBaseName}${extension}`;
  const outputPath = path.join(outputDir, safeBase);
  await fs.promises.writeFile(outputPath, outputBuffer);

  const relativeFromUploads = path
    .relative(path.join(process.cwd(), "uploads"), outputDir)
    .split(path.sep)
    .join("/");

  return {
    fileName: safeBase,
    fileUrl: `/uploads/${relativeFromUploads}/${safeBase}`.replace(/\\/g, "/"),
    fileMimeType: outputMime,
    filePath: outputPath,
  };
}

module.exports = {
  decodeSignatureDataUrl,
  createSignedDocumentFile,
  mergeSignatureOntoPdf,
  mergeSignatureOntoImage,
};
