module.exports = async function loanOfficerFeeAgreementRoutes(fastify) {
  await fastify.register(require("./getFeeAgreement"));
  await fastify.register(require("./updateFeeAgreement"));
  await fastify.register(require("./signFeeAgreement"));
  await fastify.register(require("./downloadFeeAgreementPdf"));
};
