function slugFromLabel(label, index) {
  const base = String(label || `field_${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1");
  return (base || `field_${index}`).slice(0, 64);
}

function looksLikeFillCue(content) {
  const text = String(content || "").trim();
  if (!text) return false;
  if (/_{3,}|:{1}\s*$|\[\s*\]|☐|□|\[\s*x?\s*\]/i.test(text)) return true;
  return /\b(name|date|sign|signature|initial|amount|address|phone|email|ssn|dob|title|zip|city|state)\b/i.test(
    text,
  );
}

function inferFieldType(content) {
  const text = String(content || "");
  if (/☐|□|\[\s*\]/.test(text) || /\bcheck\b/i.test(text)) return "checkbox";
  if (/\bdate|dob\b/i.test(text)) return "date";
  if (/\bemail\b/i.test(text)) return "email";
  if (/\bphone|mobile|tel\b/i.test(text)) return "phone";
  if (/\$|amount|currency|loan\s*amount/i.test(text)) return "currency";
  if (/\bsign(ature)?\b/i.test(text)) return "signature";
  if (/\binitial/i.test(text)) return "initial";
  return "text";
}

/**
 * Convert a detected text line into a draft overlay field (PDF bottom-left coords).
 */
function lineToCandidateField({
  content,
  rect,
  page,
  counter,
  source,
  confidence,
}) {
  const text = String(content || "").trim();
  if (!text || !rect || !looksLikeFillCue(text)) return null;

  const type = inferFieldType(text);
  const isBlankLine = /_{3,}/.test(text);
  const isCheckbox = type === "checkbox";

  const fieldRect = {
    x: rect.x,
    y: Math.max(0, rect.y - (isBlankLine ? 2 : 0)),
    width: Math.max(
      rect.width,
      isCheckbox ? 14 : isBlankLine ? 160 : Math.min(rect.width + 40, 280),
    ),
    height: Math.max(rect.height, isCheckbox ? 14 : 18),
  };

  const label =
    text
      .replace(/_+/g, "")
      .replace(/☐|□/g, "")
      .replace(/\[|\]/g, "")
      .replace(/:+$/, "")
      .trim() || `Field ${counter}`;

  return {
    id: `fld_${source}_${counter}`,
    key: slugFromLabel(label, counter),
    label,
    type,
    page,
    rect: fieldRect,
    required: false,
    fillRole: "either",
    meta: {
      confidence:
        typeof confidence === "number" ? confidence : source === "pdf_text" ? 0.7 : 0.6,
      source,
      detectedLabel: text,
    },
  };
}

function isFreeOcrEnabled() {
  const raw = process.env.SIGN_FORM_FREE_OCR;
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}

module.exports = {
  slugFromLabel,
  looksLikeFillCue,
  inferFieldType,
  lineToCandidateField,
  isFreeOcrEnabled,
};
