const axios = require("axios");

function getLlmConfig() {
  const apiKey = (
    process.env.SIGN_FORM_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.SIGN_FORM_LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1"
  )
    .trim()
    .replace(/\/+$/, "");
  const model =
    process.env.SIGN_FORM_LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  return { apiKey, baseUrl, model };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Refine existing detected fields only (labels/types/roles). Never invent coordinates.
 */
async function refineFieldsWithLlm({ fields, documentName }) {
  const config = getLlmConfig();
  if (!config) {
    return {
      fields: fields || [],
      provider: "llm",
      skipped: true,
      note: "LLM refine is not configured",
    };
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    return {
      fields: [],
      provider: "llm",
      skipped: true,
      note: "No fields to refine",
    };
  }

  const compact = fields.slice(0, 120).map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    fillRole: field.fillRole || "either",
    page: field.page,
    detectedLabel: field.meta?.detectedLabel || null,
  }));

  const system = [
    "You refine form-field metadata for loan/sign documents.",
    "Return ONLY valid JSON: {\"fields\":[{\"id\",\"label\",\"type\",\"fillRole\",\"required\"}]}",
    "Allowed types: text, textarea, number, currency, date, email, phone, checkbox, radio, dropdown, signature, initial.",
    "Allowed fillRole: client, broker, either, readonly. Prefer either so client and broker can both fill.",
    "Do NOT invent new fields. Do NOT change id. Do NOT invent coordinates.",
    "Prefer clearer human labels. Mark signature/date of signing as required when obvious.",
  ].join(" ");

  const user = JSON.stringify({
    documentName: documentName || "Sign document",
    fields: compact,
  });

  const res = await axios.post(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
      validateStatus: () => true,
    },
  );

  if (res.status >= 400) {
    throw new Error(
      res.data?.error?.message || `LLM refine failed (${res.status})`,
    );
  }

  const content =
    res.data?.choices?.[0]?.message?.content ||
    res.data?.output_text ||
    "";
  const parsed = extractJsonObject(content);
  const refinements = Array.isArray(parsed?.fields) ? parsed.fields : [];
  const byId = new Map(
    refinements
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item]),
  );

  const allowedTypes = new Set([
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
  const allowedRoles = new Set(["client", "broker", "either", "readonly"]);

  const refined = fields.map((field) => {
    const update = byId.get(field.id);
    if (!update) return field;

    const next = { ...field };
    if (typeof update.label === "string" && update.label.trim()) {
      next.label = update.label.trim().slice(0, 200);
    }
    if (allowedTypes.has(update.type)) {
      next.type = update.type;
    }
    if (allowedRoles.has(update.fillRole)) {
      next.fillRole = update.fillRole;
    }
    if (typeof update.required === "boolean") {
      next.required = update.required;
    }
    next.meta = {
      ...(field.meta || {}),
      llmRefined: true,
      confidence: Math.min(
        0.99,
        Math.max(Number(field.meta?.confidence) || 0.6, 0.75),
      ),
    };
    return next;
  });

  return {
    fields: refined,
    provider: "llm",
    skipped: false,
    note: `LLM refined ${byId.size} of ${fields.length} fields`,
  };
}

module.exports = {
  getLlmConfig,
  refineFieldsWithLlm,
  extractJsonObject,
};
