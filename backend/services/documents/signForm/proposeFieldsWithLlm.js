const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const axios = require("axios");
const sharp = require("sharp");
const { getLlmConfig, extractJsonObject } = require("./refineWithLlm");
const { slugFromLabel, inferFieldType } = require("./ocrHeuristics");
const { getSignFormLimits } = require("./limits");

function getPdfJsAssetUrls() {
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return {
    standardFontDataUrl: pathToFileURL(
      path.join(root, "standard_fonts") + path.sep,
    ).href,
    cMapUrl: pathToFileURL(path.join(root, "cmaps") + path.sep).href,
  };
}

function isLlmProposeEnabled() {
  // Opt-in only — OpenAI propose stays off unless SIGN_FORM_LLM_PROPOSE=true.
  const raw = process.env.SIGN_FORM_LLM_PROPOSE;
  return raw === "true" || raw === "1";
}

function getLlmProposeMinFields() {
  const n = Number(process.env.SIGN_FORM_LLM_PROPOSE_MIN_FIELDS);
  return Number.isFinite(n) && n >= 0 ? n : 8;
}

function getLlmProposeMaxPages() {
  const n = Number(process.env.SIGN_FORM_LLM_PROPOSE_MAX_PAGES);
  const limits = getSignFormLimits();
  if (Number.isFinite(n) && n >= 1) return Math.min(n, limits.maxPages);
  return Math.min(5, limits.maxPages);
}

function getLlmVisionMaxPages() {
  const n = Number(process.env.SIGN_FORM_LLM_VISION_MAX_PAGES);
  // Hard cap keeps cost/latency predictable even if env is set very high.
  const hardCap = 5;
  const capped = Math.min(getLlmProposeMaxPages(), hardCap);
  if (Number.isFinite(n) && n >= 1) return Math.min(n, capped);
  return Math.min(3, capped);
}

function getVisionRenderScale() {
  const n = Number(process.env.SIGN_FORM_LLM_VISION_SCALE);
  if (Number.isFinite(n) && n >= 1 && n <= 2.5) return n;
  return 1.4;
}

async function loadPdfJs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

function loadCanvas() {
  try {
    return require("@napi-rs/canvas");
  } catch {
    return null;
  }
}

function groupTextItemsIntoLines(items) {
  const rows = [];
  for (const item of items) {
    const str = String(item.str || "").trim();
    if (!str) continue;
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4] || 0;
    const y = transform[5] || 0;
    const width = Number(item.width) || Math.max(8, str.length * 5);
    const height = Math.abs(transform[3]) || 10;

    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 4);
    if (!row) {
      rows.push({ y, parts: [{ str, x, y, width, height }] });
      continue;
    }
    row.parts.push({ str, x, y, width, height });
  }

  return rows
    .map((row) => {
      const parts = row.parts.sort((a, b) => a.x - b.x);
      const minX = Math.min(...parts.map((p) => p.x));
      const maxX = Math.max(...parts.map((p) => p.x + p.width));
      const minY = Math.min(...parts.map((p) => p.y));
      const maxY = Math.max(...parts.map((p) => p.y + p.height));
      return {
        text: parts.map((p) => p.str).join(" ").replace(/\s+/g, " ").trim(),
        x: minX,
        y: minY,
        w: Math.max(8, maxX - minX),
        h: Math.max(8, maxY - minY),
      };
    })
    .filter((line) => line.text);
}

async function extractPdfTextLines({ filePath, pageManifest, maxPages }) {
  if (!fs.existsSync(filePath)) return [];

  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const { standardFontDataUrl, cMapUrl } = getPdfJsAssetUrls();
  const pdf = await (
    await pdfjs.getDocument({
      data,
      disableWorker: true,
      useSystemFonts: true,
      standardFontDataUrl,
      cMapUrl,
      cMapPacked: true,
    })
  ).promise;

  const pageCount = Math.min(pdf.numPages || 0, maxPages);
  const pagesOut = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const manifest = (pageManifest || []).find((p) => p.page === pageNumber);
    const widthPt = manifest?.widthPt || viewport.width || 612;
    const heightPt = manifest?.heightPt || viewport.height || 792;
    const content = await page.getTextContent();
    const lines = groupTextItemsIntoLines(content.items || []).slice(0, 90);
    pagesOut.push({
      page: pageNumber,
      widthPt,
      heightPt,
      lines,
    });
  }

  return pagesOut;
}

/**
 * Render PDF pages to JPEG for GPT vision (scanned / text-poor PDFs).
 */
async function renderPdfPagesForVision({ filePath, pageManifest, maxPages }) {
  const canvasLib = loadCanvas();
  if (!canvasLib?.createCanvas) {
    return {
      pages: [],
      error: "@napi-rs/canvas is not available for PDF vision render",
    };
  }

  const { createCanvas } = canvasLib;
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const scale = getVisionRenderScale();
  const { standardFontDataUrl, cMapUrl } = getPdfJsAssetUrls();

  const canvasFactory = {
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    },
  };

  const pdf = await (
    await pdfjs.getDocument({
      data,
      disableWorker: true,
      useSystemFonts: true,
      standardFontDataUrl,
      cMapUrl,
      cMapPacked: true,
      canvasFactory,
    })
  ).promise;

  const pageCount = Math.min(pdf.numPages || 0, maxPages);
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const manifest = (pageManifest || []).find((p) => p.page === pageNumber);
    const widthPt = manifest?.widthPt || viewport.width / scale || 612;
    const heightPt = manifest?.heightPt || viewport.height / scale || 792;

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory,
    }).promise;

    const pngBuffer = canvas.toBuffer("image/png");
    const jpegBuffer = await sharp(pngBuffer)
      .jpeg({ quality: 72, mozjpeg: true })
      .resize({
        width: Math.min(1400, Math.ceil(viewport.width)),
        withoutEnlargement: true,
      })
      .toBuffer();

    pages.push({
      page: pageNumber,
      widthPt,
      heightPt,
      renderScale: scale,
      imageWidth: (await sharp(jpegBuffer).metadata()).width || viewport.width,
      imageHeight: (await sharp(jpegBuffer).metadata()).height || viewport.height,
      mime: "image/jpeg",
      base64: jpegBuffer.toString("base64"),
    });
  }

  return { pages };
}

function clampRect(rect, widthPt, heightPt) {
  const x = Math.max(0, Math.min(Number(rect?.x) || 0, widthPt - 4));
  const y = Math.max(0, Math.min(Number(rect?.y) || 0, heightPt - 4));
  const width = Math.max(10, Math.min(Number(rect?.width) || 120, widthPt - x));
  const height = Math.max(10, Math.min(Number(rect?.height) || 18, heightPt - y));
  return { x, y, width, height };
}

const ALLOWED_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "email",
  "phone",
  "checkbox",
  "radio",
  "dropdown",
  "signature",
  "initial",
]);

function mapVisionFieldsToOverlay({
  rawFields,
  pageNumber,
  widthPt,
  heightPt,
  imageWidth,
  imageHeight,
  startCounter,
  maxFields,
}) {
  const scaleX = widthPt / Math.max(1, imageWidth);
  const scaleY = heightPt / Math.max(1, imageHeight);
  const fields = [];
  let counter = startCounter;

  for (const item of rawFields) {
    if (!item || fields.length + startCounter - 1 >= maxFields) break;
    const label = String(item.label || `Field ${counter}`).trim().slice(0, 200);
    const topLeftY = Number(item.rect?.y) || 0;
    const rawHeight = Math.max(10, Number(item.rect?.height) || 18);
    const rawWidth = Math.max(10, Number(item.rect?.width) || 120);
    const rawX = Number(item.rect?.x) || 0;

    const heightPtBox = rawHeight * scaleY;
    const rect = clampRect(
      {
        x: rawX * scaleX,
        y: heightPt - topLeftY * scaleY - heightPtBox,
        width: rawWidth * scaleX,
        height: heightPtBox,
      },
      widthPt,
      heightPt,
    );

    const type = ALLOWED_TYPES.has(item.type)
      ? item.type
      : inferFieldType(label);

    fields.push({
      id: `fld_llm_${counter}`,
      key: slugFromLabel(label, counter),
      label,
      type,
      page: pageNumber,
      rect,
      required: false,
      fillRole: "either",
      meta: {
        source: "llm_propose",
        confidence: 0.6,
        detectedLabel: label,
        via: "vision",
      },
    });
    counter += 1;
  }

  return { fields, nextCounter: counter };
}

async function proposeFieldsFromVisionPage({
  config,
  documentName,
  pageInfo,
  maxFieldsRemaining,
}) {
  const visionRes = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You place fillable form fields on a loan/business application page image.",
            'Return ONLY JSON: {"fields":[{"label","type","rect":{"x","y","width","height"}}]}',
            "Coordinates use TOP-LEFT origin in image pixels.",
            `Image size is ${pageInfo.imageWidth}x${pageInfo.imageHeight}px.`,
            "Allowed types: text, textarea, number, currency, date, email, phone, checkbox, radio, dropdown, signature, initial.",
            "Focus on real blanks, underlines, checkboxes, and signature lines. Skip logos and long legal paragraphs.",
            `Return at most ${Math.min(80, maxFieldsRemaining)} fields for this page.`,
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Document: ${documentName || "Sign form"}. Page ${pageInfo.page}. Propose fillable fields.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${pageInfo.mime};base64,${pageInfo.base64}`,
              },
            },
          ],
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 180000,
      validateStatus: () => true,
    },
  );

  if (visionRes.status >= 400) {
    throw new Error(
      visionRes.data?.error?.message ||
        `AI vision propose failed (${visionRes.status})`,
    );
  }

  const content =
    visionRes.data?.choices?.[0]?.message?.content ||
    visionRes.data?.output_text ||
    "";
  const parsed = extractJsonObject(content);
  return Array.isArray(parsed?.fields) ? parsed.fields : [];
}

async function proposeFromPdfVision({
  config,
  filePath,
  pageManifest,
  documentName,
  limits,
}) {
  const maxPages = getLlmVisionMaxPages();
  const rendered = await renderPdfPagesForVision({
    filePath,
    pageManifest,
    maxPages,
  });

  if (rendered.error) {
    return {
      fields: [],
      provider: "llm_propose",
      skipped: false,
      note: rendered.error,
    };
  }

  if (!rendered.pages.length) {
    return {
      fields: [],
      provider: "llm_propose",
      skipped: false,
      note: "Could not render PDF pages for AI vision",
    };
  }

  const allFields = [];
  let counter = 1;
  const pageErrors = [];

  for (const pageInfo of rendered.pages) {
    const remaining = limits.maxFields - allFields.length;
    if (remaining <= 0) break;
    try {
      const rawFields = await proposeFieldsFromVisionPage({
        config,
        documentName,
        pageInfo,
        maxFieldsRemaining: remaining,
      });
      const mapped = mapVisionFieldsToOverlay({
        rawFields,
        pageNumber: pageInfo.page,
        widthPt: pageInfo.widthPt,
        heightPt: pageInfo.heightPt,
        imageWidth: pageInfo.imageWidth,
        imageHeight: pageInfo.imageHeight,
        startCounter: counter,
        maxFields: limits.maxFields,
      });
      allFields.push(...mapped.fields);
      counter = mapped.nextCounter;
    } catch (error) {
      pageErrors.push(`page ${pageInfo.page}: ${error.message}`);
    }
  }

  return {
    fields: allFields,
    provider: "llm_propose",
    skipped: false,
    note:
      allFields.length > 0
        ? `AI vision proposed ${allFields.length} fields on ${rendered.pages.length} page(s) — review boxes, then Publish`
        : pageErrors.length
          ? `AI vision failed (${pageErrors[0]}). Add fields manually in Map fields.`
          : "AI vision could not propose fields. Add them manually in Map fields.",
  };
}

async function proposeFromPdfText({
  config,
  pagesPayload,
  documentName,
  limits,
}) {
  const system = [
    "You place fillable form fields on loan/sign PDF pages.",
    'Return ONLY valid JSON: {"fields":[{"label","type","page","rect":{"x","y","width","height"}}]}',
    "Coordinates are PDF points with ORIGIN AT BOTTOM-LEFT (pdf-lib).",
    "Use the provided text lines (also bottom-left) as anchors: put input boxes to the right of labels or on underline blanks.",
    "Allowed types: text, textarea, number, currency, date, email, phone, checkbox, radio, dropdown, signature, initial.",
    "Prefer either fill role implicitly (do not return fillRole).",
    "Skip headers, legal paragraphs, and logos. Prefer real blanks / labeled inputs.",
    `Return at most ${Math.min(180, limits.maxFields)} fields total.`,
  ].join(" ");

  const res = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            documentName: documentName || "Sign document",
            pages: pagesPayload,
          }),
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
      validateStatus: () => true,
    },
  );

  if (res.status >= 400) {
    throw new Error(
      res.data?.error?.message || `AI field propose failed (${res.status})`,
    );
  }

  const content =
    res.data?.choices?.[0]?.message?.content ||
    res.data?.output_text ||
    "";
  const parsed = extractJsonObject(content);
  const rawFields = Array.isArray(parsed?.fields) ? parsed.fields : [];
  const pageByNumber = new Map(
    pagesPayload.map((page) => [page.page, page]),
  );

  const fields = [];
  let counter = 1;
  for (const item of rawFields.slice(0, limits.maxFields)) {
    if (!item) continue;
    const pageNumber = Math.max(1, Number(item.page) || 1);
    const pageInfo = pageByNumber.get(pageNumber);
    if (!pageInfo) continue;
    const label = String(item.label || `Field ${counter}`).trim().slice(0, 200);
    const type = ALLOWED_TYPES.has(item.type) ? item.type : inferFieldType(label);
    const rect = clampRect(item.rect, pageInfo.widthPt, pageInfo.heightPt);
    fields.push({
      id: `fld_llm_${counter}`,
      key: slugFromLabel(label, counter),
      label,
      type,
      page: pageNumber,
      rect,
      required: false,
      fillRole: "either",
      meta: {
        source: "llm_propose",
        confidence: 0.58,
        detectedLabel: label,
        via: "text",
      },
    });
    counter += 1;
  }

  return {
    fields,
    provider: "llm_propose",
    skipped: false,
    note:
      fields.length > 0
        ? `AI proposed ${fields.length} fields — review boxes, then Publish`
        : "AI could not propose fields. Add them manually in Map fields.",
  };
}

/**
 * When AcroForm / OCR finds few or no fields, ask ChatGPT to propose
 * fillable overlay boxes (text layout, or vision for scanned PDFs).
 */
async function proposeFieldsWithLlm({
  filePath,
  pageManifest,
  documentName,
  isPdf,
  mimeType,
}) {
  const config = getLlmConfig();
  if (!config || !isLlmProposeEnabled()) {
    return {
      fields: [],
      provider: "llm_propose",
      skipped: true,
      note: config
        ? "AI field propose is disabled"
        : "AI field propose is not configured (add OPENAI_API_KEY)",
    };
  }

  const maxPages = getLlmProposeMaxPages();
  const limits = getSignFormLimits();

  if (isPdf) {
    const pagesPayload = await extractPdfTextLines({
      filePath,
      pageManifest,
      maxPages,
    });
    const lineCount = pagesPayload.reduce(
      (sum, page) => sum + (page.lines?.length || 0),
      0,
    );

    // Scanned / image-like PDFs: use vision on rendered pages.
    if (lineCount < 3) {
      return proposeFromPdfVision({
        config,
        filePath,
        pageManifest,
        documentName,
        limits,
      });
    }

    try {
      return await proposeFromPdfText({
        config,
        pagesPayload,
        documentName,
        limits,
      });
    } catch (textError) {
      // Fall back to vision if text-based propose fails.
      const vision = await proposeFromPdfVision({
        config,
        filePath,
        pageManifest,
        documentName,
        limits,
      });
      if (vision.fields?.length) return vision;
      throw textError;
    }
  }

  if (String(mimeType || "").startsWith("image/")) {
    const manifest = (pageManifest || [])[0] || {};
    const widthPt = manifest.widthPt || 612;
    const heightPt = manifest.heightPt || 792;
    let imageBytes = fs.readFileSync(filePath);
    let mime = mimeType || "image/png";

    try {
      imageBytes = await sharp(imageBytes)
        .jpeg({ quality: 72, mozjpeg: true })
        .resize({ width: 1400, withoutEnlargement: true })
        .toBuffer();
      mime = "image/jpeg";
    } catch {
      // keep original bytes
    }

    const meta = await sharp(imageBytes).metadata().catch(() => ({}));
    const imageWidth = meta.width || widthPt;
    const imageHeight = meta.height || heightPt;
    const base64 = imageBytes.toString("base64");

    const rawFields = await proposeFieldsFromVisionPage({
      config,
      documentName,
      pageInfo: {
        page: 1,
        imageWidth,
        imageHeight,
        mime,
        base64,
      },
      maxFieldsRemaining: limits.maxFields,
    });

    const mapped = mapVisionFieldsToOverlay({
      rawFields,
      pageNumber: 1,
      widthPt,
      heightPt,
      imageWidth,
      imageHeight,
      startCounter: 1,
      maxFields: limits.maxFields,
    });

    return {
      fields: mapped.fields,
      provider: "llm_propose",
      skipped: false,
      note:
        mapped.fields.length > 0
          ? `AI proposed ${mapped.fields.length} fields — review in Map fields`
          : "AI could not propose fields for this image",
    };
  }

  return {
    fields: [],
    provider: "llm_propose",
    skipped: true,
    note: "Unsupported file type for AI field propose",
  };
}

module.exports = {
  proposeFieldsWithLlm,
  isLlmProposeEnabled,
  getLlmProposeMinFields,
  getLlmProposeMaxPages,
  getLlmVisionMaxPages,
  renderPdfPagesForVision,
};
