const { z } = require("zod");

function sanitizeUsageLimits(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === "" || raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      out[key] = n;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

const usageLimitsSchema = z.preprocess(
  sanitizeUsageLimits,
  z.record(z.string(), z.number().int().nonnegative()).nullable().optional(),
);

module.exports = { usageLimitsSchema, sanitizeUsageLimits };
