const subBrokerAuthRoutes = require("./auth/index");

const subBrokerLoanPipelineRoutes = require("./loanPipeline");

const feeAgreementRoutes = require("./feeAgreement");

const loiRoutes = require("./loi/listLoi");

const documentRoutes = require("./documents");

const messagingRoutes = require("./messaging");

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

  // MESSAGING
    fastify.register(messagingRoutes, {
    prefix: "/messaging",
  });

  fastify.register(require("./commissions"), {
    prefix: "/commissions",
  });

  fastify.register(require("./applications"), {
    prefix: "/applications",
  });

  fastify.register(require("./borrowers"), {
    prefix: "/borrowers",
  });

  fastify.register(require("./contacts"), {
    prefix: "/contacts",
  });

  fastify.register(require("./notifications"), {
    prefix: "/notifications",
  });
}

module.exports = subBrokerRoutes;
