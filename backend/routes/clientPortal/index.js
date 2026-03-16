async function clientPortalRoutes(fastify) {

  fastify.register(require("./verifyToken"));
  fastify.register(require("./uploadDocuments"));

}

module.exports = clientPortalRoutes;