async function loanPipelineRoutes(fastify) {
  fastify.register(require("./submissionDocuments"), { prefix: "" });
  fastify.register(require("./uploadSubmissionDocument"),{prefix:""});
  fastify.register(require("./listLoi"));   
  fastify.register(require("./viewLoi"));
  fastify.register(require("./listLender"));


  fastify.register(require("./sendClientLink"));
  fastify.register(require("./requestDocuments"));
  fastify.register(require("./submitDocumentsToLender"));

  fastify.register(require("./deleteDocument.js"));

  fastify.register(require("./getSubmittedlenders.js"));

  fastify.register(require("./feeAgreement"));
  fastify.register(require("./listSubmissions"));
}

module.exports = loanPipelineRoutes;
