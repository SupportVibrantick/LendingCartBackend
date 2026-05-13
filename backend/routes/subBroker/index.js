const subBrokerAuthRoutes = require("./auth/index");

const subBrokerLoanPipelineRoutes = require("./loanPipeline");

const feeAgreementRoutes = require("./feeAgreement");

const loiRoutes = require("./loi/listLoi");

const documentRoutes = require("./documents")

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

  // DOCUMENT
  fastify.register(documentRoutes, {
    prefix: "/documents",
  });
}

module.exports = subBrokerRoutes;
