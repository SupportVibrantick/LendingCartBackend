const getFeeAgreementRoute = require("./feeAgreement");
const downloadFeeAgreementPdfRoute = require("./downloadFeeAgreementPdf");

async function feeAgreementRoutes(fastify, options) {
  fastify.register(getFeeAgreementRoute);
  fastify.register(downloadFeeAgreementPdfRoute);
}

module.exports = feeAgreementRoutes;
