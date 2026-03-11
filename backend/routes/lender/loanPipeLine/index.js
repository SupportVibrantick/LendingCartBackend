async function loanPipelineRoutes(fastify) {
  fastify.register(require("./list"));


  fastify.register(require("./details"));
  fastify.register(require("./decision"));
  fastify.register(require("./lenderViewDocuments"));
  fastify.register(require("./generateLoi"));
  fastify.register(require("./viewLoi.js"));
}

module.exports = loanPipelineRoutes;