const { PDFDocument, PDFName } = require("pdf-lib");

function slugKey(name, index) {
  const base = String(name || `field_${index}`)
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1");
  return (base || `field_${index}`).slice(0, 64);
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

function resolvePageIndex(pdfDoc, widget) {
  try {
    const pageRef = widget.dict.get(PDFName.of("P"));
    if (!pageRef) return 0;
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i += 1) {
      if (pages[i].ref === pageRef) return i;
    }
  } catch {
    // fall through
  }
  return 0;
}

/**
 * Extract native PDF AcroForm fields with PDF-point rectangles (bottom-left).
 */
async function detectAcroFormFields(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  let form;
  try {
    form = pdfDoc.getForm();
  } catch {
    return { fields: [], provider: "acroform", note: "No AcroForm present" };
  }

  const detected = [];
  const usedKeys = new Set();
  const acroFields = form.getFields();

  acroFields.forEach((field, index) => {
    const type = classifyAcroField(field);
    if (!type) return;

    const name = field.getName?.() || `Field ${index + 1}`;
    let key = slugKey(name, index + 1);
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${slugKey(name, index + 1)}_${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);

    let widgets = [];
    try {
      widgets = field.acroField?.getWidgets?.() || [];
    } catch {
      widgets = [];
    }

    if (!widgets.length) return;

    if (type === "radio") {
      const options = [];
      let firstRect = null;
      let page = 1;

      widgets.forEach((widget, widgetIndex) => {
        const rect = widget.getRectangle?.();
        if (!rect) return;
        if (!firstRect) {
          firstRect = rect;
          page = resolvePageIndex(pdfDoc, widget) + 1;
        }
        options.push({
          label: `Option ${widgetIndex + 1}`,
          value: `option_${widgetIndex + 1}`,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        });
      });

      if (!firstRect || !options.length) return;

      detected.push({
        id: `fld_acro_${key}`,
        key,
        label: name,
        type: "radio",
        page,
        rect: {
          x: firstRect.x,
          y: firstRect.y,
          width: Math.max(firstRect.width, 40),
          height: Math.max(
            firstRect.height,
            options.length * (firstRect.height + 4),
          ),
        },
        required: false,
        fillRole: "either",
        options,
        meta: {
          confidence: 0.95,
          source: "acroform",
          detectedLabel: name,
        },
      });
      return;
    }

    const widget = widgets[0];
    const rect = widget.getRectangle?.();
    if (!rect) return;
    const page = resolvePageIndex(pdfDoc, widget) + 1;

    const fieldPayload = {
      id: `fld_acro_${key}`,
      key,
      label: name,
      type,
      page,
      rect: {
        x: rect.x,
        y: rect.y,
        width: Math.max(rect.width, type === "checkbox" ? 12 : 40),
        height: Math.max(rect.height, type === "checkbox" ? 12 : 14),
      },
      required: false,
      fillRole: "either",
      meta: {
        confidence: 0.95,
        source: "acroform",
        detectedLabel: name,
      },
    };

    if (type === "dropdown") {
      try {
        const options = field.getOptions?.() || [];
        fieldPayload.options = options.map((opt) => ({
          label: String(opt),
          value: String(opt),
        }));
      } catch {
        fieldPayload.options = [];
      }
    }

    detected.push(fieldPayload);
  });

  return {
    fields: detected,
    provider: "acroform",
    note: detected.length
      ? `Extracted ${detected.length} AcroForm fields`
      : "No AcroForm fields found",
  };
}

module.exports = {
  detectAcroFormFields,
  slugKey,
  classifyAcroField,
};
