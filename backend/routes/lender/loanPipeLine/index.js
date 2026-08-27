async function loanPipelineRoutes(fastify) {
  fastify.register(require("./list"));


  fastify.register(require("./details"));
  fastify.register(require("./decision"));
  fastify.register(require("./lenderViewDocuments"));
  fastify.register(require("./generateLoi"));
  fastify.register(require("./sendLoiToBroker"));
  fastify.register(require("./loiVersions"));
  fastify.register(require("./viewLoi.js"));
  fastify.register(require("./uploadLoiTemplate.js"));
  fastify.register(require("./getLoanPipelineStats.js"));
  fastify.register(require("./signDocuments.js"));
  fastify.register(require("./signForm.js"));
}

module.exports = loanPipelineRoutes;