const {
  isSba504Product,
  isNoMinLoanCriteriaProduct,
  isMezzanineProduct,
} = require("../lender/lenderProductCriteria");

function isMinMaxLoanAmountRangeValid(item) {
  const code = item.loanProductCode;

  if (isSba504Product(code)) {
    const total = item.maxTotalProjectAmount;
    const debenture = item.maxSba504DebentureAmount;
    if (total == null || debenture == null) {
      return true;
    }
    return debenture <= total;
  }

  if (isNoMinLoanCriteriaProduct(code) || isMezzanineProduct(code)) {
    return true;
  }

  const min = item.minLoanAmount;
  const max = item.maxLoanAmount;
  if (min == null || max == null) {
    return true;
  }

  return min <= max;
}

function getMinMaxLoanAmountRangeError(item) {
  const code = item.loanProductCode;

  if (isSba504Product(code)) {
    return "maxSba504DebentureAmount cannot be greater than maxTotalProjectAmount";
  }

  return "minLoanAmount cannot be greater than maxLoanAmount";
}

function isMinMaxTermRangeValid(item) {
  const min = item.minTermMonths;
  const max = item.maxTermMonths;
  if (min == null || max == null) {
    return true;
  }
  return min <= max;
}

module.exports = {
  isMinMaxLoanAmountRangeValid,
  getMinMaxLoanAmountRangeError,
  isMinMaxTermRangeValid,
};
