/**
 * Remove null values from request payloads so Zod `.optional()` fields validate.
 * JSON clients often send `null` for omitted product-specific criteria fields.
 */
function stripNullValues(value) {
  if (value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(stripNullValues);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, stripNullValues(entry)])
        .filter(([, entry]) => entry !== undefined),
    );
  }

  return value;
}

module.exports = { stripNullValues };
