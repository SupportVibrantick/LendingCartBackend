const subBrokerAuthRoutes = require("./auth/index");

const subBrokerLoanPipelineRoutes = require("./loanPipeline");

const feeAgreementRoutes = require("./feeAgreement");

const loiRoutes = require("./loi/listLoi");

async function subBrokerRoutes(fastify, options) {
  // AUTH
  fastify.register(subBrokerAuthRoutes, {
    prefix: "/auth",
  });

  // LOAN PIPELINE
  fastify.register(subBrokerLoanPipelineRoutes, {
    prefix: "/loan-pipeline",
  });

  // FEE AGREEMENT
  fastify.register(feeAgreementRoutes, {
    prefix: "/fee-agreement",
  });

  // LOI
  fastify.register(loiRoutes, {
    prefix: "/view-loi",
  });
}

module.exports = subBrokerRoutes;
