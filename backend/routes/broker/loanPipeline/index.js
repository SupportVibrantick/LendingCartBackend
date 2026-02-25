async function loanPipelineRoutes(fastify) {
  fastify.register(require("./submissionDocuments"), { prefix: "" });
}

module.exports = loanPipelineRoutes;
