const fs = require("fs");
const axios = require("axios");

function getAzureConfig() {
  const endpoint = (
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ||
    process.env.AZURE_FORM_RECOGNIZER_KEY ||
    ""
  ).trim();
  const apiVersion =
    process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION || "2024-11-30";
  const modelId =
    process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL || "prebuilt-layout";

  if (!endpoint || !apiKey) {
    return null;
  }

  return { endpoint, apiKey, apiVersion, modelId };
}

function polygonToRect(polygon, pageWidthPt, pageHeightPt, unit = "inch") {
  if (!Array.isArray(polygon) || polygon.length < 4) return null;

  const points = [];
  if (typeof polygon[0] === "number") {
    for (let i = 0; i + 1 < polygon.length; i += 2) {
      points.push({ x: polygon[i], y: polygon[i + 1] });
    }
  } else {
    for (const point of polygon) {
      if (point && typeof point.x === "number") {
        points.push({ x: point.x, y: point.y });
      }
    }
  }

  if (points.length < 2) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const scale = unit === "inch" ? 72 : unit === "pixel" ? 1 : 72;
  // Azure Y is top-left origin; convert to PDF bottom-left.
  const x = minX * scale;
  const width = Math.max(8, (maxX - minX) * scale);
  const top = minY * scale;
  const height = Math.max(8, (maxY - minY) * scale);
  const y = pageHeightPt - top - height;

  return {
    x: Math.max(0, Math.min(x, pageWidthPt - 4)),
    y: Math.max(0, Math.min(y, pageHeightPt - 4)),
    width: Math.min(width, pageWidthPt),
    height: Math.min(height, pageHeightPt),
  };
}

function slugFromLabel(label, index) {
  const base = String(label || `azure_field_${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1");
  return (base || `azure_field_${index}`).slice(0, 64);
}

async function pollAzureResult(operationUrl, apiKey, { timeoutMs = 90000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await axios.get(operationUrl, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      timeout: 30000,
      validateStatus: () => true,
    });

    if (res.status >= 400) {
      throw new Error(
        res.data?.error?.message || `Azure poll failed (${res.status})`,
      );
    }

    const status = res.data?.status;
    if (status === "succeeded") return res.data;
    if (status === "failed") {
      throw new Error(res.data?.error?.message || "Azure analysis failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("Azure analysis timed out");
}

/**
 * Detect candidate fields from Azure Document Intelligence layout.
 * Returns fields in PDF-point coordinates (bottom-left).
 */
async function detectAzureLayoutFields({
  filePath,
  mimeType,
  pageManifest,
}) {
  const config = getAzureConfig();
  if (!config) {
    return {
      fields: [],
      provider: "azure_layout",
      skipped: true,
      note: "Azure Document Intelligence is not configured",
    };
  }

  const bytes = fs.readFileSync(filePath);
  const analyzeUrl = `${config.endpoint}/documentintelligence/documentModels/${config.modelId}:analyze?api-version=${encodeURIComponent(config.apiVersion)}`;

  const startRes = await axios.post(analyzeUrl, bytes, {
    headers: {
      "Ocp-Apim-Subscription-Key": config.apiKey,
      "Content-Type": mimeType || "application/pdf",
    },
    timeout: 60000,
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });

  if (startRes.status !== 202) {
    throw new Error(
      startRes.data?.error?.message ||
        `Azure analyze start failed (${startRes.status})`,
    );
  }

  const operationUrl =
    startRes.headers["operation-location"] ||
    startRes.headers["Operation-Location"];
  if (!operationUrl) {
    throw new Error("Azure analyze response missing operation-location");
  }

  const result = await pollAzureResult(operationUrl, config.apiKey);
  const analyzeResult = result?.analyzeResult || {};
  const pages = analyzeResult.pages || [];
  const detected = [];
  let counter = 1;

  for (const page of pages) {
    const pageNumber = page.pageNumber || 1;
    const manifest = (pageManifest || []).find((p) => p.page === pageNumber);
    const pageWidthPt =
      manifest?.widthPt ||
      (page.unit === "inch" ? (page.width || 8.5) * 72 : page.width || 612);
    const pageHeightPt =
      manifest?.heightPt ||
      (page.unit === "inch" ? (page.height || 11) * 72 : page.height || 792);
    const unit = page.unit || "inch";

    for (const mark of page.selectionMarks || []) {
      const rect = polygonToRect(
        mark.polygon,
        pageWidthPt,
        pageHeightPt,
        unit,
      );
      if (!rect) continue;
      const key = `azure_check_${counter}`;
      detected.push({
        id: `fld_azure_${counter}`,
        key,
        label: `Checkbox ${counter}`,
        type: "checkbox",
        page: pageNumber,
        rect,
        required: false,
        fillRole: "either",
        meta: {
          confidence: typeof mark.confidence === "number" ? mark.confidence : 0.7,
          source: "azure_layout",
          detectedLabel: mark.state || "checkbox",
        },
      });
      counter += 1;
    }

    for (const line of page.lines || []) {
      const content = String(line.content || "").trim();
      if (!content) continue;
      // Blank-line / fill-in cues
      if (!/_{3,}|:{1}\s*$|\[\s*\]/.test(content) && !/\b(name|date|sign|amount|address|phone|email)\b/i.test(content)) {
        continue;
      }

      const rect = polygonToRect(
        line.polygon,
        pageWidthPt,
        pageHeightPt,
        unit,
      );
      if (!rect) continue;

      // Expand short underline regions into input-sized boxes
      const isBlankLine = /_{3,}/.test(content);
      const fieldRect = {
        x: rect.x,
        y: Math.max(0, rect.y - (isBlankLine ? 2 : 0)),
        width: Math.max(rect.width, isBlankLine ? 160 : rect.width),
        height: Math.max(rect.height, 18),
      };

      let type = "text";
      if (/\bdate\b/i.test(content)) type = "date";
      else if (/\bemail\b/i.test(content)) type = "email";
      else if (/\bphone|mobile|tel\b/i.test(content)) type = "phone";
      else if (/\$|amount|currency|loan\s*amount/i.test(content)) type = "currency";
      else if (/\bsign(ature)?\b/i.test(content)) type = "signature";
      else if (/\binitial/i.test(content)) type = "initial";

      const label = content.replace(/_+/g, "").replace(/:+$/, "").trim() || `Field ${counter}`;
      const key = slugFromLabel(label, counter);

      detected.push({
        id: `fld_azure_${counter}`,
        key,
        label,
        type,
        page: pageNumber,
        rect: fieldRect,
        required: false,
        fillRole: "either",
        meta: {
          confidence: typeof line.confidence === "number" ? line.confidence : 0.65,
          source: "azure_layout",
          detectedLabel: content,
        },
      });
      counter += 1;
    }
  }

  // Cap very noisy detections
  const capped = detected.slice(0, 200);

  return {
    fields: capped,
    provider: "azure_layout",
    skipped: false,
    note: capped.length
      ? `Azure layout suggested ${capped.length} fields`
      : "Azure layout returned no candidate fields",
    rawSummary: {
      pageCount: pages.length,
      selectionMarks: pages.reduce(
        (sum, page) => sum + (page.selectionMarks?.length || 0),
        0,
      ),
      lines: pages.reduce((sum, page) => sum + (page.lines?.length || 0), 0),
    },
  };
}

module.exports = {
  getAzureConfig,
  detectAzureLayoutFields,
  polygonToRect,
};
