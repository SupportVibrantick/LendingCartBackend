const listRoutes = require("./list");
// future ready
// const inviteRoutes = require("./invite");
// const revokeRoutes = require("./revoke");

 /**
  * @param {import("fastify").FastifyInstance} fastify
  */
async function lenderBrokerRoutes(fastify) {
  fastify.register(listRoutes, { prefix: "/list" });

  // future
  // fastify.register(inviteRoutes, { prefix: "/invite" });
  // fastify.register(revokeRoutes, { prefix: "/revoke" });
}

module.exports = lenderBrokerRoutes;
