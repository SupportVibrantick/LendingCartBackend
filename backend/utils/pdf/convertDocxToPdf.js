const fs = require("fs");
const path = require("path");
const util = require("util");
const libre = require("libreoffice-convert");

const convertWithOptionsAsync = util.promisify(libre.convertWithOptions);

function getSofficeCandidates() {
  const fromEnv = process.env.LIBRE_OFFICE_EXE
    ? [process.env.LIBRE_OFFICE_EXE]
    : [];

  if (process.platform === "win32") {
    return [
      ...fromEnv,
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
      path.join(process.env["PROGRAMFILES(X86)"] || "", "LibreOffice/program/soffice.exe"),
      path.join(process.env.PROGRAMFILES || "", "LibreOffice/program/soffice.exe"),
    ];
  }

  if (process.platform === "darwin") {
    return [
      ...fromEnv,
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ];
  }

  return [
    ...fromEnv,
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/snap/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
    "/opt/libreoffice7.6/program/soffice",
  ];
}

function resolveSofficeBinary() {
  for (const candidate of getSofficeCandidates()) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore invalid paths */
    }
  }
  return null;
}

async function convertDocxToPdf(docxBuffer) {
  const sofficeBinary = resolveSofficeBinary();

  if (!sofficeBinary) {
    const error = new Error("LibreOffice not installed");
    error.code = "LIBREOFFICE_MISSING";
    throw error;
  }

  const pdfBuffer = await convertWithOptionsAsync(
    docxBuffer,
    ".pdf",
    undefined,
    {
      sofficeBinaryPaths: [sofficeBinary],
      fileName: "loi-source.docx",
    },
  );

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error("Empty PDF generated");
  }

  return pdfBuffer;
}

module.exports = {
  convertDocxToPdf,
  resolveSofficeBinary,
};
