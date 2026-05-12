const getFeeAgreementRoute = require("./feeAgreement");

async function feeAgreementRoutes(fastify, options) {
  fastify.register(getFeeAgreementRoute);
}

module.exports = feeAgreementRoutes;
