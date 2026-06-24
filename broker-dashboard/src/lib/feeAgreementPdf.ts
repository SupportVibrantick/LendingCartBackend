import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesInHtml(html: string): Promise<string> {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  const images = Array.from(wrapper.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;

      try {
        const response = await fetch(resolveImageUrl(src), { mode: "cors" });
        if (!response.ok) throw new Error("Image fetch failed");
        const blob = await response.blob();
        img.setAttribute("src", await blobToDataUrl(blob));
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
  host.innerHTML = html;
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

function savePdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadFeeAgreementPdfFromApi(
  downloadUrl: string,
  headers: HeadersInit,
  filename: string,
): Promise<boolean> {
  const response = await fetch(downloadUrl, { headers });

  if (!response.ok) {
    return false;
  }

  const blob = await response.blob();
  if (!blob.size) {
    return false;
  }

  savePdfBlob(blob, filename);
  return true;
}

export async function downloadFeeAgreementPdf(options: {
  agreementHtml?: string | null;
  element?: HTMLElement | null;
  filename: string;
  downloadUrl?: string;
  getAuthHeaders?: () => HeadersInit;
}): Promise<void> {
  const { agreementHtml, element, filename, downloadUrl, getAuthHeaders } =
    options;

  if (downloadUrl && getAuthHeaders) {
    try {
      const downloaded = await downloadFeeAgreementPdfFromApi(
        downloadUrl,
        getAuthHeaders(),
        filename,
      );
      if (downloaded) return;
    } catch {
      /* fall back to client-side generation */
    }
  }

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
