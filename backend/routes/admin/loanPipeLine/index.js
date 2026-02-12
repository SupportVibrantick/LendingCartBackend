async function loanPipelineRoutes(fastify) {
  fastify.register(require("./list"));
  fastify.register(require("./details"));
}

module.exports = loanPipelineRoutes;