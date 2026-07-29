import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const PDF_MARGIN_X_MM = 8;
const PDF_MARGIN_Y_MM = 8;

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DEFAULT_BRAND_NAME = "Loan Automation";
const DEFAULT_LOGO_PATH = "/images/logo/logo.svg";

export function resolvePdfAssetUrl(src: string): string {
  if (
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }

  if (src.startsWith("/") && !src.startsWith("/uploads")) {
    return src;
  }

  if (src.startsWith("/")) {
    return `${API_BASE}${src}`;
  }

  return `${API_BASE}/${src}`;
}

export function resolvePdfLogoUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }
  return resolvePdfAssetUrl(src);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildApplicationDetailsPdfFilename(data: {
  applicationNumber?: string | null;
  borrowerName?: string | null;
  submissionId?: string | null;
}): string {
  const base =
    sanitizeFilenamePart(
      String(
        data.applicationNumber ||
          data.borrowerName ||
          data.submissionId ||
          "application",
      ),
    ) || "application";

  return `Loan-Application-${base}.pdf`;
}

/** Split long narrative fields so each chunk fits on one PDF page slice. */
export function splitLongTextForPdf(
  text: string,
  maxChars = 2400,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return ["—"];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
    current = "";
  };

  const pushOversizedParagraph = (paragraph: string) => {
    let remaining = paragraph;
    while (remaining.length > maxChars) {
      let splitAt = remaining.lastIndexOf(" ", maxChars);
      if (splitAt <= 0) splitAt = maxChars;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) current = remaining;
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    flush();
    if (paragraph.length > maxChars) {
      pushOversizedParagraph(paragraph);
      flush();
    } else {
      current = paragraph;
    }
  }

  flush();
  return chunks.length ? chunks : ["—"];
}

const CANVAS_SCALE = 2;

type PdfBlockRect = {
  top: number;
  bottom: number;
  height: number;
};

function getPdfBlockRects(element: HTMLElement, scale: number): PdfBlockRect[] {
  const rootRect = element.getBoundingClientRect();

  return Array.from(element.querySelectorAll("[data-pdf-block]")).map((block) => {
    const rect = block.getBoundingClientRect();
    const top = Math.round((rect.top - rootRect.top) * scale);
    const bottom = Math.round((rect.bottom - rootRect.top) * scale);

    return {
      top,
      bottom,
      height: bottom - top,
    };
  });
}

function resolveSliceEndPx(
  currentY: number,
  pageSliceHeightPx: number,
  canvasHeight: number,
  blocks: PdfBlockRect[],
): number {
  const idealEnd = Math.min(currentY + pageSliceHeightPx, canvasHeight);
  if (idealEnd >= canvasHeight) return canvasHeight;

  const crossingBlock = blocks
    .filter(
      (block) =>
        block.top < idealEnd &&
        block.bottom > idealEnd &&
        block.bottom > currentY,
    )
    .sort((a, b) => a.top - b.top)[0];

  if (!crossingBlock) return idealEnd;

  if (crossingBlock.top <= currentY) {
    const restHeight = crossingBlock.bottom - currentY;
    if (restHeight <= pageSliceHeightPx) {
      return Math.min(crossingBlock.bottom, canvasHeight);
    }
    return idealEnd;
  }

  if (crossingBlock.bottom - currentY <= pageSliceHeightPx) {
    return Math.min(crossingBlock.bottom, canvasHeight);
  }

  if (crossingBlock.top > currentY) {
    return crossingBlock.top;
  }

  return idealEnd;
}

async function renderElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: CANVAS_SCALE,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const blocks = getPdfBlockRects(element, CANVAS_SCALE);

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_MARGIN_X_MM * 2;
  const contentHeight = pageHeight - PDF_MARGIN_Y_MM * 2;

  const pxPerMm = canvas.width / contentWidth;
  const pageSliceHeightPx = Math.max(1, Math.floor(contentHeight * pxPerMm));

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    const sliceEnd = resolveSliceEndPx(
      sourceY,
      pageSliceHeightPx,
      canvas.height,
      blocks,
    );
    const sliceHeightPx = Math.max(1, sliceEnd - sourceY);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const context = pageCanvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas not supported");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    const sliceData = pageCanvas.toDataURL("image/jpeg", 0.92);
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    pdf.addImage(
      sliceData,
      "JPEG",
      PDF_MARGIN_X_MM,
      PDF_MARGIN_Y_MM,
      contentWidth,
      sliceHeightMm,
      undefined,
      "FAST",
    );

    sourceY = Math.max(sourceY + 1, sliceEnd);
    pageIndex += 1;
  }

  pdf.save(filename);
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (!images.length) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight !== 0) {
            resolve();
            return;
          }

          img.onload = () => resolve();
          img.onerror = () => resolve();
          window.setTimeout(resolve, 3000);
        }),
    ),
  ).then(() => undefined);
}

export async function downloadApplicationDetailsPdf(options: {
  element: HTMLElement | null;
  filename: string;
}): Promise<void> {
  const { element, filename } = options;

  if (!element) {
    throw new Error("No application content available for PDF export");
  }

  await waitForImages(element);
  await new Promise((resolve) => window.setTimeout(resolve, 200));
  await renderElementToPdf(element, filename);
}

export type BrokerPdfProfile = {
  name: string;
  organizationName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  address: string;
};

export type BrokerPdfBranding = {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

function getDefaultBranding(): BrokerPdfBranding {
  try {
    const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    return {
      brandName: user.organizationName || DEFAULT_BRAND_NAME,
      logoUrl: DEFAULT_LOGO_PATH,
      primaryColor: "#13538A",
      secondaryColor: "#2C92D5",
    };
  } catch {
    return {
      brandName: DEFAULT_BRAND_NAME,
      logoUrl: DEFAULT_LOGO_PATH,
      primaryColor: "#13538A",
      secondaryColor: "#2C92D5",
    };
  }
}

export async function fetchBrokerBrandingForPdf(): Promise<BrokerPdfBranding> {
  try {
    const token = sessionStorage.getItem("broker_token");
    if (!token) return getDefaultBranding();

    const res = await fetch(`${API_BASE}/broker/white-label/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      return getDefaultBranding();
    }

    const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    const brandName =
      String(json.data?.brandName || "").trim() ||
      user.organizationName ||
      DEFAULT_BRAND_NAME;

    const rawLogo = json.data?.logoUrl
      ? resolvePdfLogoUrl(json.data.logoUrl)
      : DEFAULT_LOGO_PATH;

    return {
      brandName,
      logoUrl: rawLogo,
      primaryColor: json.data?.primaryColor || "#13538A",
      secondaryColor: json.data?.secondaryColor || "#2C92D5",
    };
  } catch {
    return getDefaultBranding();
  }
}

export function getBrokerProfileForPdf(): BrokerPdfProfile {
  try {
    const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    const profile = user.brokerProfile || {};

    const name =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.name ||
      "—";

    const addressParts = [
      profile.address,
      profile.city,
      profile.state,
      profile.zipCode,
    ].filter(Boolean);

    return {
      name,
      organizationName: user.organizationName || profile.company || "—",
      email: user.email || "—",
      phone: user.phone || "—",
      licenseNumber: profile.licenseNumber || "—",
      address: addressParts.join(", ") || "—",
    };
  } catch {
    return {
      name: "—",
      organizationName: "—",
      email: "—",
      phone: "—",
      licenseNumber: "—",
      address: "—",
    };
  }
}
