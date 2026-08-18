const {
  validateFeeAgreementTerms,
  normalizeFeeAgreementTerms,
} = require("./feeAgreementEnrichment");
const createFeeAgreement = require("../../routes/broker/loanPipeline/feeAgreement/createFeeAgreement");

function isMissingFeeTerm(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function parseOptionalFeeAgreementInput(body = {}) {
  const payload = body.feeAgreement;
  if (!payload || payload.include !== true) {
    return { include: false, terms: null, errors: [] };
  }

  const errors = [];
  if (isMissingFeeTerm(payload.brokerPoints)) {
    errors.push("Broker fee is required when including a fee agreement.");
  }
  if (isMissingFeeTerm(payload.upfrontFee)) {
    errors.push("Upfront fee is required when including a fee agreement.");
  }
  if (isMissingFeeTerm(payload.exclusivityMonths)) {
    errors.push("Exclusivity months is required when including a fee agreement.");
  }

  const terms = normalizeFeeAgreementTerms({
    brokerPoints: payload.brokerPoints,
    upfrontFee: payload.upfrontFee,
    exclusivityMonths: payload.exclusivityMonths,
  });
  errors.push(...validateFeeAgreementTerms(terms));

  return { include: true, terms, errors };
}

function getFeeAgreementRequestError(body) {
  const parsed = parseOptionalFeeAgreementInput(body);
  if (parsed.include && parsed.errors.length) {
    return parsed.errors[0];
  }
  return null;
}

async function attachFeeAgreementIfRequested(fastify, loanId, body) {
  const parsed = parseOptionalFeeAgreementInput(body);
  if (!parsed.include) return null;
  if (parsed.errors.length) {
    const error = new Error(parsed.errors[0]);
    error.statusCode = 400;
    throw error;
  }
  return createFeeAgreement(fastify, loanId, parsed.terms);
}

async function tryAttachFeeAgreementIfRequested(fastify, loanId, body) {
  try {
    await attachFeeAgreementIfRequested(fastify, loanId, body);
    return null;
  } catch (feeErr) {
    fastify.log.error(
      {
        error: feeErr.message,
        applicationId: loanId,
      },
      "Fee agreement creation failed after application submit",
    );
    return (
      feeErr.message ||
      "Fee agreement could not be created. You can add it from the submitted application."
    );
  }
}

module.exports = {
  parseOptionalFeeAgreementInput,
  getFeeAgreementRequestError,
  attachFeeAgreementIfRequested,
  tryAttachFeeAgreementIfRequested,
};
