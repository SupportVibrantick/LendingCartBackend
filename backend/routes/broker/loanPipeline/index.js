async function loanPipelineRoutes(fastify) {
  fastify.register(require("./submissionDocuments"), { prefix: "" });
  fastify.register(require("./uploadSubmissionDocument"),{prefix:""});
  fastify.register(require("./listLoi"));   // NEW
  fastify.register(require("./viewLoi"));
  fastify.register(require("./listLender"));
}

module.exports = loanPipelineRoutes;
