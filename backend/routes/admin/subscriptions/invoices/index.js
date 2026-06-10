const listRoutes = require("./list");
const generateRoutes = require("./generate");
const markPaidRoutes = require("./markPaid");

async function invoicesRoutes(fastify) {
  fastify.register(listRoutes, { prefix: "/read" });
  fastify.register(generateRoutes, { prefix: "/generate" });
  fastify.register(markPaidRoutes, { prefix: "/mark-paid" });
}

module.exports = invoicesRoutes;
