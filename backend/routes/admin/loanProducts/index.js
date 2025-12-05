async function loanProductRoutes(fastify) {
  fastify.register(require("./create"), { prefix:"/create" });
  fastify.register(require("./read"),   { prefix:"/list" });
  fastify.register(require("./update"), { prefix:"/update" });
  fastify.register(require("./status"), { prefix:"/status" });
}

module.exports = loanProductRoutes;
