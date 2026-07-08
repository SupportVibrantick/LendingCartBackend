const { isFeeTermConfigured } = require("../../services/feeAgreement/feeAgreementEnrichment");
const { resolveCommissionLoanAmount } = require("../commission/commissionHelpers");

/**
 * Ensure fee agreement and commission prerequisites exist before funding.
 * @throws {Error} when mark-as-funded must be blocked
 */
function validateMarkFundedPrerequisites(loan) {
  if (!loan) {
    throw new Error("Loan application not found");
  }

  if (!loan.feeAgreement) {
    throw new Error(
      "Fee agreement is required before marking this deal as funded. Complete the Fee Agreement tab first.",
    );
  }

  if (!isFeeTermConfigured(loan.feeAgreement.brokerPoints)) {
    throw new Error(
      "Broker points must be set in the Fee Agreement before marking as funded.",
    );
  }

  const loanAmount = resolveCommissionLoanAmount(loan);
  if (!loanAmount || loanAmount <= 0) {
    throw new Error(
      "Loan amount is required before marking as funded. Add the loan amount on the application.",
    );
  }

  return {
    loanAmount,
    brokerPoints: Number(loan.feeAgreement.brokerPoints),
  };
}

function getMarkFundedEligibility(loan) {
  try {
    validateMarkFundedPrerequisites(loan);
    return { canMarkFunded: true, markFundedBlockedReason: null };
  } catch (error) {
    return {
      canMarkFunded: false,
      markFundedBlockedReason: error.message || "Cannot mark as funded yet",
    };
  }
}

module.exports = {
  validateMarkFundedPrerequisites,
  getMarkFundedEligibility,
};
