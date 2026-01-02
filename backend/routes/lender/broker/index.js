const listRoutes = require("./list");
const findRoutes = require("./find");
const inviteRoutes = require("./invite");
const invitedRoutes = require("./inviteList");

async function lenderBrokerRoutes(fastify) {
  fastify.register(listRoutes, { prefix: "/list" });
  fastify.register(findRoutes, { prefix: "/find" });
  fastify.register(inviteRoutes, { prefix: "/invite" });
  fastify.register(invitedRoutes, { prefix: "/invites" });
}

module.exports = lenderBrokerRoutes;
