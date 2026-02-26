async function loanPipelineRoutes(fastify) {
  fastify.register(require("./submissionDocuments"), { prefix: "" });
  fastify.register(require("./uploadSubmissionDocument"),{prefix:""});
}

module.exports = loanPipelineRoutes;
