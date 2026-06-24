module.exports = async function (fastify) {
  fastify.register(require("./getFeeAgreement"));
  fastify.register(require("./updateFeeAgreement"));
  fastify.register(require("./signFeeAgreement"));
  fastify.register(require("./downloadFeeAgreementPdf"));
};