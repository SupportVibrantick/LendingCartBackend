export type SignFormFieldType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "email"
  | "phone"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "signature"
  | "initial"
  | "textarea";

export type SignFormFillRole = "client" | "broker" | "either" | "readonly";

export type SignFormRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SignFormFieldOption = {
  label: string;
  value: string;
  rect?: SignFormRect;
};

export type SignFormField = {
  id: string;
  key: string;
  label: string;
  type: SignFormFieldType;
  page: number;
  rect: SignFormRect;
  required?: boolean;
  placeholder?: string | null;
  options?: SignFormFieldOption[] | null;
  fillRole?: SignFormFillRole;
  editable?: boolean;
  readOnly?: boolean;
  visible?: boolean;
};

export type SignFormPage = {
  page: number;
  widthPt: number;
  heightPt: number;
  imageUrl?: string | null;
  rotation?: number;
};

export type SignFormConditional = {
  when: { field: string; equals: unknown };
  show?: string[];
  require?: string[];
};

export type SignFormSchema = {
  schemaVersion: 1;
  pages: SignFormPage[];
  fields: SignFormField[];
  conditionals?: SignFormConditional[];
  tables?: Array<{
    id: string;
    label: string;
    page: number;
    columns: Array<{ key: string; label: string; type?: SignFormFieldType }>;
    rows: number;
    originRect: SignFormRect;
  }>;
};

export type SignFormPayload = {
  definitionId: string | null;
  requirementId: string;
  title: string;
  definitionStatus: string | null;
  versionId: string | null;
  version: number | null;
  versionStatus: string | null;
  publishedAt?: string | null;
  schema: SignFormSchema | null;
  pageManifest: SignFormPage[] | null;
  signMode: string;
  formProcessingStatus: string;
  activeFormVersionId?: string | null;
  templateFileUrl?: string | null;
  templateMimeType?: string | null;
  templateFileName?: string | null;
  signStatus?: string | null;
  submission?: {
    id: string;
    status: string;
    values: Record<string, unknown>;
  } | null;
  progress?: {
    client: { required: number; filled: number; total: number; complete: boolean };
    broker: { required: number; filled: number; total: number; complete: boolean };
    all: { required: number; filled: number; total: number; complete: boolean };
  } | null;
  readOnly?: boolean;
};

/** Convert PDF bottom-left rect → CSS top-left style using page height. */
export function pdfRectToCss(
  rect: SignFormRect,
  pageHeightPt: number,
  scale: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: rect.x * scale,
    top: (pageHeightPt - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/** Convert CSS top-left box → PDF bottom-left rect. */
export function cssBoxToPdfRect(
  box: { left: number; top: number; width: number; height: number },
  pageHeightPt: number,
  scale: number,
): SignFormRect {
  const width = box.width / scale;
  const height = box.height / scale;
  const x = box.left / scale;
  const y = pageHeightPt - box.top / scale - height;
  return { x, y, width, height };
}

export function createEmptyField(
  page: number,
  pageWidthPt: number,
  pageHeightPt: number,
  type: SignFormFieldType = "text",
): SignFormField {
  const id = `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const width = type === "checkbox" ? 14 : type === "signature" ? 180 : 160;
  const height =
    type === "checkbox" ? 14 : type === "signature" || type === "initial" ? 40 : 22;
  const x = Math.max(36, pageWidthPt * 0.2);
  const y = Math.max(36, pageHeightPt * 0.55);

  return {
    id,
    key: id,
    label:
      type === "signature"
        ? "Signature"
        : type === "initial"
          ? "Initials"
          : "New Field",
    type,
    page,
    rect: { x, y, width, height },
    required: type === "signature",
    fillRole: "either",
    options:
      type === "radio"
        ? [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]
        : null,
  };
}

export const FIELD_TYPE_OPTIONS: Array<{
  value: SignFormFieldType;
  label: string;
}> = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text area" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio" },
  { value: "dropdown", label: "Dropdown" },
  { value: "signature", label: "Signature" },
  { value: "initial", label: "Initials" },
];

function unwrapFormValue(raw: unknown) {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return (raw as { value: unknown }).value;
  }
  return raw;
}

function valuesEqual(actual: unknown, expected: unknown) {
  if (actual === expected) return true;
  if (typeof expected === "boolean" || typeof actual === "boolean") {
    const toBool = (value: unknown) =>
      value === true ||
      value === "true" ||
      value === "yes" ||
      value === "Yes" ||
      value === 1 ||
      value === "1";
    return toBool(actual) === toBool(expected);
  }
  return String(actual ?? "") === String(expected ?? "");
}

export function evaluateSignFormConditionals(
  schema: Pick<SignFormSchema, "fields" | "conditionals"> | null | undefined,
  values: Record<string, unknown> = {},
) {
  const fields = schema?.fields || [];
  const conditionals = schema?.conditionals || [];
  const hiddenKeys = new Set<string>();
  const extraRequiredKeys = new Set<string>();
  const keySet = new Set(fields.map((field) => field.key));

  for (const rule of conditionals) {
    for (const key of rule.show || []) {
      if (keySet.has(key)) hiddenKeys.add(key);
    }
  }

  for (const rule of conditionals) {
    const triggerKey = rule.when?.field;
    if (!triggerKey) continue;
    if (!valuesEqual(unwrapFormValue(values[triggerKey]), rule.when.equals)) {
      continue;
    }
    for (const key of rule.show || []) hiddenKeys.delete(key);
    for (const key of rule.require || []) {
      if (keySet.has(key) && !hiddenKeys.has(key)) extraRequiredKeys.add(key);
    }
  }

  return { hiddenKeys, extraRequiredKeys };
}
