const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerLoanPipelineRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  fastify.register(require("./getApplications"));
  fastify.register(require("./listSubmissions"));
  fastify.register(require("./pipelineStats"));
  fastify.register(require("./submissionDocuments"));
  fastify.register(require("./uploadSubmissionDocument"));
  fastify.register(require("./requestDocuments"));
  fastify.register(require("./submitDocumentsToLender"));
  fastify.register(require("./updateDocumentAutoForward"));
  fastify.register(require("./listLoi"));
  fastify.register(require("../../broker/loanPipeline/brokerLoi")({
    tagPrefix: "Loan Officer",
    requireBrokerUserId: true,
  }), { prefix: "" });
  fastify.register(require("./getSubmittedlenders"));
  fastify.register(require("./sendClientLink"));
  fastify.register(require("./feeAgreement"));
  fastify.register(require("./signDocuments"));
}

module.exports = loanOfficerLoanPipelineRoutes;
