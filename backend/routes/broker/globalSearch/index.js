async function globalSearchRoutes(fastify) {
  fastify.register(require("./search"), { prefix: "/" });
}

module.exports = globalSearchRoutes;
