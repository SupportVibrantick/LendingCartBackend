const inviteLenderRoutes = require("./invite");

async function lendersRoutes(fastify) {
  fastify.register(inviteLenderRoutes, {
    prefix: "/invite",
  });
}

module.exports = lendersRoutes;