// services/eligibility/evaluateRuleSet.js
const { evaluateRule } = require("./evaluateRule");

/**
 * @param {object} ruleSet - EligibilityRuleSet with rules[]
 * @param {object} applicantData - application inputs
 */
function evaluateRuleSet(ruleSet, applicantData) {
  const results = [];
  let eligible = true;

  for (const rule of ruleSet.rules) {
    const result = evaluateRule(rule, applicantData);
    results.push(result);

    if (!result.passed && result.severity === "HARD_FAIL") {
      eligible = false;
      break; // stop on hard failure
    }
  }

  return {
    ruleSetId: ruleSet.id,
    eligible,
    results,
  };
}

module.exports = {
  evaluateRuleSet,
};
