const { registerOfficerRouteGuards } = require("../../../services/broker/loanOfficerAccess");

async function loanOfficerLoanPipelineRoutes(fastify) {
  registerOfficerRouteGuards(fastify, "VIEW_APPLICATIONS");

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
      routePermissions: {
        view: "VIEW_LOI_TERM_SHEET",
        generate: ["GENERATE_LOI", "REGENERATE_LOI"],
        sendToClient: "SEND_LOI_TO_CLIENT",
        forwardToLender: "SEND_LOI_TO_LENDER",
      },
    }),
    { prefix: "" },
  );
  await fastify.register(require("./getSubmittedlenders"));
  await fastify.register(require("./sendClientLink"));
  await fastify.register(require("./feeAgreement"));
  await fastify.register(require("./signDocuments"));
}

module.exports = loanOfficerLoanPipelineRoutes;
