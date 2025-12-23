// services/eligibility/operator.js

function normalize(value) {
  if (value === null || value === undefined) return null;
  if (!isNaN(value)) return Number(value);
  return String(value).toLowerCase();
}

function evaluateOperator(operator, fieldValue, ruleValue) {
  const left = normalize(fieldValue);
  const right = normalize(ruleValue);

  switch (operator) {
    case "GT":
      return left > right;

    case "GTE":
      return left >= right;

    case "LT":
      return left < right;

    case "LTE":
      return left <= right;

    case "EQ":
      return left === right;

    case "NEQ":
      return left !== right;

    case "IN":
      if (!Array.isArray(ruleValue)) return false;
      return ruleValue.map(normalize).includes(left);

    case "NOT_IN":
      if (!Array.isArray(ruleValue)) return false;
      return !ruleValue.map(normalize).includes(left);

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

module.exports = {
  evaluateOperator,
};
