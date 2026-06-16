const { officerPreHandler } = require("../../../services/loanOfficerAccess");

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
  fastify.register(require("./getSubmittedlenders"));
  fastify.register(require("./sendClientLink"));
  fastify.register(require("./feeAgreement"));
}

module.exports = loanOfficerLoanPipelineRoutes;
