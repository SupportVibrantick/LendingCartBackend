const {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFNumber,
} = require("pdf-lib");

function slugKey(name, index) {
  const base = String(name || `field_${index}`)
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1");
  return (base || `field_${index}`).slice(0, 64);
}

/**
 * Prefer tooltip / leaf segment of XFA-style names.
 */
function humanizeFieldLabel(name, tooltip, index) {
  const tip = String(tooltip || "").trim();
  if (tip) {
    let cleaned = tip
      .replace(/^please\s+/i, "")
      .replace(/^(type|enter|select|provide|choose)\s+/i, "")
      .replace(/\s+by pressing enter\.?$/i, "")
      .replace(/\s+here\.?$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned) {
      return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 120);
    }
  }

  const raw = String(name || "").trim();
  if (!raw) return `Field ${index + 1}`;
  const parts = raw.split(".").filter(Boolean);
  const leaf = parts[parts.length - 1] || raw;
  const cleaned = leaf
    .replace(/\[\d+\]/g, "")
    .replace(/[_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || raw;
}

function slugKeyFromName(name, index) {
  const label = humanizeFieldLabel(name, null, index);
  return slugKey(label, index);
}

function classifyAcroField(field) {
  const ctor = field.constructor?.name || "";
  if (ctor.includes("CheckBox")) return "checkbox";
  if (ctor.includes("RadioGroup")) return "radio";
  if (ctor.includes("Dropdown") || ctor.includes("OptionList")) return "dropdown";
  if (ctor.includes("Signature")) return "signature";
  if (ctor.includes("Button")) return null;
  return "text";
}

function samePdfRef(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    if (typeof a.equals === "function" && a.equals(b)) return true;
  } catch {
    // ignore
  }
  return String(a) === String(b);
}

function parsePageFromFieldName(fieldName) {
  const raw = String(fieldName || "");
  const match = raw.match(/\.P(\d+)\[/i);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isFinite(page) && page >= 1 ? page : null;
}

function readPdfText(dict, key) {
  try {
    const raw = dict.get(PDFName.of(key));
    if (!raw) return null;
    if (typeof raw.decodeText === "function") return raw.decodeText();
    if (typeof raw.asString === "function") return raw.asString();
    return String(raw).replace(/^\//, "");
  } catch {
    return null;
  }
}

function readPdfRect(dict) {
  try {
    const rectObj = dict.lookup(PDFName.of("Rect"));
    if (!rectObj || typeof rectObj.size !== "function") return null;
    const arr = [];
    for (let i = 0; i < rectObj.size(); i += 1) {
      const value = rectObj.get(i);
      arr.push(
        value instanceof PDFNumber ? value.asNumber() : Number(value?.asNumber?.()),
      );
    }
    if (arr.length < 4 || arr.some((n) => !Number.isFinite(n))) return null;
    return {
      x: Math.min(arr[0], arr[2]),
      y: Math.min(arr[1], arr[3]),
      width: Math.abs(arr[2] - arr[0]),
      height: Math.abs(arr[3] - arr[1]),
    };
  } catch {
    return null;
  }
}

function rectKey(rect) {
  if (!rect) return "";
  // Integer PDF points — enough to dedupe pdf-lib vs raw Annot Rect float noise
  return [
    Math.round(Number(rect.x)),
    Math.round(Number(rect.y)),
    Math.round(Number(rect.width)),
    Math.round(Number(rect.height)),
  ].join(",");
}

function readFieldFlags(dict) {
  try {
    const ff = dict.get(PDFName.of("Ff"));
    if (!ff) return 0;
    if (ff instanceof PDFNumber) return ff.asNumber();
    if (typeof ff.asNumber === "function") return ff.asNumber();
    return Number(ff) || 0;
  } catch {
    return 0;
  }
}

function classifyAnnotField(dict) {
  const ft = String(dict.get(PDFName.of("FT")) || "");
  const flags = readFieldFlags(dict);

  if (ft === "/Sig") return "signature";
  if (ft === "/Tx") {
    // Multiline
    if (flags & (1 << 12)) return "textarea";
    return "text";
  }
  if (ft === "/Ch") {
    // Combo box
    if (flags & (1 << 17)) return "dropdown";
    return "dropdown";
  }
  if (ft === "/Btn") {
    // Pushbutton
    if (flags & (1 << 16)) return null;
    // Radio
    if (flags & (1 << 15)) return "radio";
    return "checkbox";
  }
  // Some widgets omit FT; infer from name
  const name = readPdfText(dict, "T") || "";
  if (/signature|sign/i.test(name)) return "signature";
  return "text";
}

function findPageIndexByAnnot(pdfDoc, widget) {
  try {
    const widgetRef = widget?.ref;
    if (!widgetRef) return null;
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i += 1) {
      const annots = pages[i].node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annots) continue;
      for (let j = 0; j < annots.size(); j += 1) {
        if (samePdfRef(annots.get(j), widgetRef)) return i;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

function resolvePageIndex(pdfDoc, widget, fieldName = "", rectPageMap = null) {
  try {
    const pageRef =
      (typeof widget?.P === "function" ? widget.P() : null) ||
      widget?.dict?.get?.(PDFName.of("P"));
    if (pageRef) {
      const pages = pdfDoc.getPages();
      for (let i = 0; i < pages.length; i += 1) {
        if (samePdfRef(pages[i].ref, pageRef)) return i;
      }
    }
  } catch {
    // fall through
  }

  const annotPage = findPageIndexByAnnot(pdfDoc, widget);
  if (annotPage != null) return annotPage;

  try {
    const rect = widget?.getRectangle?.();
    const mapped = rect && rectPageMap ? rectPageMap.get(rectKey(rect)) : null;
    if (mapped != null) return mapped - 1;
  } catch {
    // fall through
  }

  const namedPage = parsePageFromFieldName(fieldName);
  if (namedPage != null) {
    const max = pdfDoc.getPageCount?.() || pdfDoc.getPages().length;
    if (namedPage <= max) return namedPage - 1;
  }

  return 0;
}

function uniqueKey(usedKeys, base, index) {
  let key = slugKey(base, index);
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${slugKey(base, index)}_${suffix}`.slice(0, 64);
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

/**
 * Collect every Widget annotation from page Annots arrays.
 * Official SBA forms expose many fields here that pdf-lib getFields() misses.
 */
function collectPageWidgetAnnots(pdfDoc) {
  const pages = pdfDoc.getPages();
  const widgets = [];
  const rectPageMap = new Map();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const annots = pages[pageIndex].node.lookupMaybe(
      PDFName.of("Annots"),
      PDFArray,
    );
    if (!annots) continue;

    for (let j = 0; j < annots.size(); j += 1) {
      let annot;
      try {
        annot = pdfDoc.context.lookup(annots.get(j));
      } catch {
        continue;
      }
      if (!(annot instanceof PDFDict)) continue;
      if (String(annot.get(PDFName.of("Subtype"))) !== "/Widget") continue;

      const rect = readPdfRect(annot);
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;

      const type = classifyAnnotField(annot);
      if (!type) continue;

      const name = readPdfText(annot, "T") || `Field_${pageIndex + 1}_${j + 1}`;
      const tooltip = readPdfText(annot, "TU");
      const page = pageIndex + 1;
      rectPageMap.set(rectKey(rect), page);

      widgets.push({
        page,
        name,
        tooltip,
        type,
        rect: {
          x: rect.x,
          y: rect.y,
          width: Math.max(rect.width, type === "checkbox" ? 12 : 40),
          height: Math.max(rect.height, type === "checkbox" ? 12 : 14),
        },
      });
    }
  }

  return { widgets, rectPageMap };
}

/**
 * Extract native PDF AcroForm fields with PDF-point rectangles (bottom-left).
 *
 * IMPORTANT: Never call pdf-lib getForm() / getFields() here.
 * On large SBA / LiveCycle PDFs that path blocks the Node event loop for
 * minutes and freezes the whole API (pipeline, brokers, etc. all hang).
 * Page Widget Annots already cover official fillable forms.
 */
async function detectAcroFormFields(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const { widgets: pageWidgets } = collectPageWidgetAnnots(pdfDoc);
  const detected = [];
  const usedKeys = new Set();

  pageWidgets.forEach((widget, index) => {
    const key = uniqueKey(
      usedKeys,
      slugKeyFromName(widget.name, index + 1),
      index + 1,
    );
    detected.push({
      id: `fld_acro_${key}`,
      key,
      label: humanizeFieldLabel(widget.name, widget.tooltip, index),
      type: widget.type,
      page: widget.page,
      rect: widget.rect,
      required: false,
      fillRole: "either",
      meta: {
        confidence: 0.96,
        source: "acroform",
        detectedLabel: widget.name,
        tooltip: widget.tooltip || null,
      },
    });
  });

  const pageCounts = detected.reduce((acc, field) => {
    acc[field.page] = (acc[field.page] || 0) + 1;
    return acc;
  }, {});

  return {
    fields: detected,
    provider: "acroform",
    note: detected.length
      ? `Extracted ${detected.length} AcroForm fields across ${Object.keys(pageCounts).length} page(s)`
      : "No fillable PDF widgets found on page annotations",
    pageCounts,
  };
}

module.exports = {
  detectAcroFormFields,
  slugKey,
  slugKeyFromName,
  humanizeFieldLabel,
  classifyAcroField,
  parsePageFromFieldName,
  resolvePageIndex,
  collectPageWidgetAnnots,
};
