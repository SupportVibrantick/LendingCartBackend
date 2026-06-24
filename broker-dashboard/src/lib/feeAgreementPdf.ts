import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const LOGO_MAX_WIDTH = 220;
const LOGO_MAX_HEIGHT = 96;
const SIGNATURE_MAX_WIDTH = 220;
const SIGNATURE_MAX_HEIGHT = 80;

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFeeAgreementPdfFilename(data: {
  clientName?: string | null;
  clientEntityName?: string | null;
  id?: string;
  loanApplicationId?: string;
}): string {
  const base =
    sanitizeFilenamePart(
      String(
        data.clientEntityName ||
          data.clientName ||
          data.loanApplicationId ||
          data.id ||
          "fee-agreement",
      ),
    ) || "fee-agreement";

  return `Fee-Agreement-${base}-signed.pdf`;
}

function resolveImageUrl(src: string): string {
  if (
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }

  if (src.startsWith("/")) {
    return `${API_BASE}${src}`;
  }

  return src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function resizeImageDataUrl(
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
): { dataUrl: string; width: number; height: number } {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas not supported");
  }

  context.drawImage(image, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
  };
}

async function inlineImagesInHtml(html: string): Promise<string> {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  const images = Array.from(wrapper.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src) return;

      const isSignature = /signature/i.test(
        `${img.getAttribute("alt") || ""} ${src}`,
      );
      const maxWidth = isSignature ? SIGNATURE_MAX_WIDTH : LOGO_MAX_WIDTH;
      const maxHeight = isSignature ? SIGNATURE_MAX_HEIGHT : LOGO_MAX_HEIGHT;

      try {
        const resolvedSrc = src.startsWith("data:")
          ? src
          : resolveImageUrl(src);
        const loadedImage = await loadImage(resolvedSrc);
        const resized = resizeImageDataUrl(loadedImage, maxWidth, maxHeight);

        img.setAttribute("src", resized.dataUrl);
        img.removeAttribute("style");
        img.setAttribute("width", String(resized.width));
        img.setAttribute("height", String(resized.height));
      } catch {
        img.remove();
      }
    }),
  );

  return wrapper.innerHTML;
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

function buildPrintHost(html: string): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-fee-agreement-pdf", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: "794px",
    background: "#ffffff",
    color: "#111827",
    padding: "32px",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "12px",
    lineHeight: "1.5",
    boxSizing: "border-box",
  });

  const style = document.createElement("style");
  style.textContent = `
    [data-fee-agreement-pdf] img {
      display: block;
      margin: 8px auto;
      object-fit: contain;
    }
    [data-fee-agreement-pdf] h2,
    [data-fee-agreement-pdf] h3,
    [data-fee-agreement-pdf] p {
      color: #111827;
    }
    [data-fee-agreement-pdf] div {
      border-color: #e2e8f0 !important;
      border-radius: 0 !important;
      background: #ffffff !important;
    }
  `;

  host.appendChild(style);

  const content = document.createElement("div");
  content.innerHTML = html;
  host.appendChild(content);

  return host;
}

async function renderElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 1,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

export async function downloadFeeAgreementPdf(options: {
  agreementHtml?: string | null;
  element?: HTMLElement | null;
  filename: string;
}): Promise<void> {
  const { agreementHtml, element, filename } = options;

  if (agreementHtml?.trim()) {
    const host = buildPrintHost(await inlineImagesInHtml(agreementHtml));
    document.body.appendChild(host);

    try {
      await waitForImages(host);
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      await renderElementToPdf(host, filename);
      return;
    } finally {
      document.body.removeChild(host);
    }
  }

  if (element) {
    await renderElementToPdf(element, filename);
    return;
  }

  throw new Error("No agreement content available for PDF export");
}
