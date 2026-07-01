async function loanPipelineRoutes(fastify) {
  fastify.register(require("./submissionDocuments"), { prefix: "" });
  fastify.register(require("./uploadSubmissionDocument"), { prefix: "" });
  fastify.register(require("./listLoi"));
  fastify.register(require("./viewLoi"));
  fastify.register(require("./listLender"));

  fastify.register(require("./sendClientLink"));
  fastify.register(require("./requestDocuments"));
  fastify.register(require("./submitDocumentsToLender"));
  fastify.register(require("./updateDocumentAutoForward"), { prefix: "" });

  fastify.register(require("./deleteDocument.js"));

  fastify.register(require("./getSubmittedlenders.js"));
  fastify.register(require("./markFunded.js"));

  fastify.register(require("./feeAgreement"));
  fastify.register(require("./listSubmissions"));
  fastify.register(require("./skipSubBrokerSubmission.js"));
  fastify.register(require("./stats.js"));
  fastify.register(require("./signDocuments.js"));
  fastify.register(require("./getClientApplicationLink.js"));
  fastify.register(require("./documentReminders.js"));

  // fastify.register(require("./submitDocumentsToBroker"));
  // fastify.register(require("./listSubBrokerSubmissions"));
  // fastify.register(require("./reviewSubBrokerSubmission"));
  // fastify.register(require("./skipSubBrokerSubmission"));
  // fastify.register(require("./sendSubBrokerDocsToLender"));
}

module.exports = loanPipelineRoutes;
