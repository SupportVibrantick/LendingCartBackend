import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const PDF_MARGIN_X_MM = 8;
const PDF_MARGIN_Y_MM = 8;

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DEFAULT_BRAND_NAME = "Loan Automation";

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

  // Block already started on this page — keep it intact when possible.
  if (crossingBlock.top <= currentY) {
    const restHeight = crossingBlock.bottom - currentY;
    if (restHeight <= pageSliceHeightPx) {
      return Math.min(crossingBlock.bottom, canvasHeight);
    }
    return idealEnd;
  }

  // Entire block fits in the remaining space on this page.
  if (crossingBlock.bottom - currentY <= pageSliceHeightPx) {
    return Math.min(crossingBlock.bottom, canvasHeight);
  }

  // Block would be cut — move it to the next page.
  if (crossingBlock.top > currentY) {
    return crossingBlock.top;
  }

  return idealEnd;
}

function getPdfAuthToken(): string | null {
  return (
    sessionStorage.getItem("lender_token") ||
    sessionStorage.getItem("broker_token")
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function imageElementToDataUrl(image: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, image.naturalWidth || image.width || 1);
  canvas.height = Math.max(1, image.naturalHeight || image.height || 1);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas not supported");
  }
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

async function resolveImageDataUrl(src: string): Promise<string | null> {
  if (!src || src.startsWith("data:")) {
    if (src?.includes("image/svg")) {
      try {
        return imageElementToDataUrl(await loadImageElement(src));
      } catch {
        return src;
      }
    }
    return src || null;
  }

  const resolved = resolvePdfAssetUrl(src);
  const fetchUrl = resolved.startsWith("http")
    ? resolved
    : `${window.location.origin}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;

  const token = getPdfAuthToken();
  const headers: Record<string, string> = {};
  if (
    token &&
    (fetchUrl.includes("/uploads") || fetchUrl.startsWith(API_BASE))
  ) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(fetchUrl, { headers });
    if (response.ok) {
      const dataUrl = await blobToDataUrl(await response.blob());
      if (
        dataUrl.includes("image/svg") ||
        fetchUrl.toLowerCase().endsWith(".svg")
      ) {
        try {
          return imageElementToDataUrl(await loadImageElement(dataUrl));
        } catch {
          return dataUrl;
        }
      }
      return dataUrl;
    }
  } catch {
    // Fall back to image element loading below.
  }

  try {
    const dataUrl = imageElementToDataUrl(await loadImageElement(fetchUrl));
    return dataUrl;
  } catch {
    return null;
  }
}

async function inlineImagesInElement(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src) {
        img.remove();
        return;
      }

      const dataUrl = await resolveImageDataUrl(src);
      if (!dataUrl) {
        img.remove();
        return;
      }

      img.setAttribute("src", dataUrl);
      img.removeAttribute("crossorigin");
    }),
  );
}

async function captureElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const captureWidth = Math.max(
    element.offsetWidth,
    element.scrollWidth,
    element.clientWidth,
    794,
  );
  const captureHeight = Math.max(
    element.offsetHeight,
    element.scrollHeight,
    element.clientHeight,
    1,
  );

  if (captureHeight <= 1) {
    throw new Error("PDF content has no renderable height");
  }

  const baseOptions = {
    scale: CANVAS_SCALE,
    backgroundColor: "#ffffff",
    logging: false,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    scrollX: 0,
    scrollY: 0,
  };

  try {
    return await html2canvas(element, {
      ...baseOptions,
      useCORS: true,
      allowTaint: false,
    });
  } catch {
    return html2canvas(element, {
      ...baseOptions,
      useCORS: true,
      allowTaint: true,
    });
  }
}

async function renderElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await captureElementToCanvas(element);

  if (!canvas.width || !canvas.height) {
    throw new Error("Unable to render PDF canvas");
  }

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
  const maxPages = 60;

  while (sourceY < canvas.height && pageIndex < maxPages) {
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

function resolveCaptureRoot(element: HTMLElement): HTMLElement {
  if (element.dataset.applicationDetailsPdf === "true") {
    return element;
  }

  const marked = element.querySelector(
    '[data-application-details-pdf="true"]',
  ) as HTMLElement | null;

  return marked || element;
}

function buildPdfCaptureHost(source: HTMLElement): {
  host: HTMLDivElement;
  captureRoot: HTMLElement;
} {
  const host = document.createElement("div");
  host.setAttribute("data-pdf-capture-host", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "794px",
    background: "#ffffff",
    zIndex: "-1",
    opacity: "0",
    pointerEvents: "none",
  });

  const captureRoot = source.cloneNode(true) as HTMLElement;
  Object.assign(captureRoot.style, {
    visibility: "visible",
    opacity: "1",
    position: "relative",
    left: "0",
    top: "0",
    zIndex: "auto",
    pointerEvents: "none",
    width: "794px",
  });
  host.appendChild(captureRoot);

  return { host, captureRoot };
}

export async function downloadApplicationDetailsPdf(options: {
  element: HTMLElement | null;
  filename: string;
}): Promise<void> {
  const { element, filename } = options;

  if (!element) {
    throw new Error("No application content available for PDF export");
  }

  const sourceRoot = resolveCaptureRoot(element);
  const { host, captureRoot } = buildPdfCaptureHost(sourceRoot);
  document.body.appendChild(host);
  captureRoot.getBoundingClientRect();

  try {
    await inlineImagesInElement(captureRoot);
    await waitForImages(captureRoot);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    await renderElementToPdf(captureRoot, filename);
  } finally {
    host.remove();
  }
}

export type BrokerPdfProfile = {
  name: string;
  organizationName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  address: string;
};

export type PdfBranding = {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

function getLenderSessionContext() {
  try {
    const user = JSON.parse(sessionStorage.getItem("lender_user") || "{}");
    return {
      organizationName: String(user.organizationName || "").trim() || DEFAULT_BRAND_NAME,
    };
  } catch {
    return { organizationName: DEFAULT_BRAND_NAME };
  }
}

function normalizeBrandingLogoUrl(logoUrl: unknown): string | null {
  const trimmed = String(logoUrl ?? "").trim();
  if (!trimmed) return null;
  return resolvePdfLogoUrl(trimmed);
}

function getDefaultLenderBranding(): PdfBranding {
  const { organizationName } = getLenderSessionContext();
  return {
    brandName: organizationName,
    logoUrl: null,
    primaryColor: "#13538A",
    secondaryColor: "#2C92D5",
  };
}

export async function fetchLenderBrandingForPdf(): Promise<PdfBranding> {
  const defaults = getDefaultLenderBranding();

  try {
    const token = sessionStorage.getItem("lender_token");
    if (!token) return defaults;

    const res = await fetch(`${API_BASE}/lender/branding/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      return defaults;
    }

    const savedBrandName = String(json.data?.brandName ?? "").trim();
    const savedLogoUrl = normalizeBrandingLogoUrl(json.data?.logoUrl);

    return {
      brandName: savedBrandName || defaults.brandName,
      logoUrl: savedLogoUrl,
      primaryColor: "#13538A",
      secondaryColor: "#2C92D5",
    };
  } catch {
    return defaults;
  }
}

export function getBrokerProfileFromApplication(
  applicationLender: {
    brokerName?: string | null;
    loanApplication?: {
      brokerOrg?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        licenseNumber?: string | null;
        contactName?: string | null;
      } | null;
    } | null;
  } | null,
): BrokerPdfProfile {
  const brokerOrg = applicationLender?.loanApplication?.brokerOrg;

  return {
    name:
      brokerOrg?.contactName ||
      applicationLender?.brokerName ||
      "—",
    organizationName: brokerOrg?.name || "—",
    email: brokerOrg?.email || "—",
    phone: brokerOrg?.phone || "—",
    licenseNumber: brokerOrg?.licenseNumber || "—",
    address: brokerOrg?.address || "—",
  };
}
