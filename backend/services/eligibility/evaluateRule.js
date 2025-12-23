// services/eligibility/evaluateRule.js
const { evaluateOperator } = require("./operator");

/**
 * @param {object} rule - EligibilityRule row
 * @param {object} applicantData - flattened application data
 */
function evaluateRule(rule, applicantData) {
  const fieldValue = applicantData[rule.fieldName];

  if (fieldValue === undefined) {
    return {
      ruleId: rule.id,
      passed: rule.severity !== "HARD_FAIL",
      message: `Missing field: ${rule.fieldName}`,
      severity: rule.severity,
    };
  }

  let ruleValue = rule.value;

  // Support JSON values (arrays etc.)
  try {
    ruleValue = JSON.parse(rule.value);
  } catch (_) {}

  const passed = evaluateOperator(
    rule.comparisonOperator,
    fieldValue,
    ruleValue
  );

  return {
    ruleId: rule.id,
    passed,
    severity: rule.severity,
    message: passed ? null : rule.message,
    fieldValue: String(fieldValue),
  };
}

module.exports = {
  evaluateRule,
};
