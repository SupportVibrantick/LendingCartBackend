function unwrapValue(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return raw.value;
  }
  return raw;
}

function valuesEqual(actual, expected) {
  if (actual === expected) return true;
  if (actual == null && (expected === "" || expected == null)) return true;

  if (typeof expected === "boolean" || typeof actual === "boolean") {
    const toBool = (value) =>
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

function fieldLookupKey(field) {
  return field?.key || field?.id;
}

/**
 * Fields listed in any rule.show start hidden, then appear when the rule matches.
 * Extra require keys become required only while the matching rule is true.
 */
function evaluateConditionals(schema, values = {}) {
  const fields = schema?.fields || [];
  const conditionals = schema?.conditionals || [];
  const hiddenKeys = new Set();
  const extraRequiredKeys = new Set();
  const keySet = new Set(fields.map((field) => field.key));

  const showControlled = new Set();
  for (const rule of conditionals) {
    for (const key of rule.show || []) {
      if (keySet.has(key)) showControlled.add(key);
    }
  }
  for (const key of showControlled) hiddenKeys.add(key);

  for (const rule of conditionals) {
    const triggerKey = rule?.when?.field;
    if (!triggerKey) continue;
    const matched = valuesEqual(unwrapValue(values[triggerKey]), rule.when.equals);
    if (!matched) continue;

    for (const key of rule.show || []) {
      hiddenKeys.delete(key);
    }
    for (const key of rule.require || []) {
      if (keySet.has(key) && !hiddenKeys.has(key)) {
        extraRequiredKeys.add(key);
      }
    }
  }

  return { hiddenKeys, extraRequiredKeys };
}

function isFieldVisible(field, evaluation) {
  const key = fieldLookupKey(field);
  return key ? !evaluation.hiddenKeys.has(key) : true;
}

function isFieldRequiredNow(field, evaluation) {
  if (!isFieldVisible(field, evaluation)) return false;
  return Boolean(field.required) || evaluation.extraRequiredKeys.has(field.key);
}

function visibleFields(schema, values) {
  const evaluation = evaluateConditionals(schema, values);
  return (schema?.fields || []).filter((field) => isFieldVisible(field, evaluation));
}

module.exports = {
  unwrapValue,
  valuesEqual,
  evaluateConditionals,
  isFieldVisible,
  isFieldRequiredNow,
  visibleFields,
};
