const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerLoanPipelineRoutes(fastify) {
  for (const handler of officerPreHandler(fastify)) {
    fastify.addHook("preHandler", handler);
  }

  await fastify.register(require("./getApplications"));
  await fastify.register(require("./listSubmissions"));
  await fastify.register(require("./pipelineStats"));
  await fastify.register(require("./submissionDocuments"));
  await fastify.register(require("./uploadSubmissionDocument"));
  await fastify.register(require("./requestDocuments"));
  await fastify.register(require("./submitDocumentsToLender"));
  await fastify.register(require("./updateDocumentAutoForward"));
  await fastify.register(require("./listLoi"));
  await fastify.register(
    require("../../broker/loanPipeline/brokerLoi")({
      tagPrefix: "Loan Officer",
      requireBrokerUserId: true,
    }),
    { prefix: "" },
  );
  await fastify.register(require("./getSubmittedlenders"));
  await fastify.register(require("./sendClientLink"));
  await fastify.register(require("./feeAgreement"));
  await fastify.register(require("./signDocuments"));
}

module.exports = loanOfficerLoanPipelineRoutes;
