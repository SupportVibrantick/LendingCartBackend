const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

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
  return path.join(process.cwd(), relative);
}

async function mergeSignatureOntoPdf(pdfPath, signatureBuffer) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pngImage = await pdfDoc.embedPng(signatureBuffer);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();
  const sigWidth = 180;
  const sigHeight = 70;

  lastPage.drawImage(pngImage, {
    x: Math.max(24, width - sigWidth - 36),
    y: 36,
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

  if (mime === "application/pdf" || extension.toLowerCase() === ".pdf") {
    outputBuffer = await mergeSignatureOntoPdf(templatePath, signatureBuffer);
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
  const safeBase = `${outputBaseName}${extension}`;
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
