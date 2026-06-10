const createRoutes = require("./create");
const readRoutes = require("./list");
const updateRoutes = require("./update");
const statusRoutes = require("./toggleStatus");
const deleteRoutes = require("./delete");
const subscribersRoutes = require("./subscribers");
const invoicesRoutes = require("./invoices");

async function subscriptions(fastify, options) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(readRoutes, { prefix: "/read" });
  fastify.register(updateRoutes, { prefix: "/update" });
  fastify.register(statusRoutes, { prefix: "/status" });
  fastify.register(deleteRoutes, { prefix: "/delete" });
  fastify.register(subscribersRoutes, { prefix: "/subscribers" });
  fastify.register(invoicesRoutes, { prefix: "/invoices" });
}

module.exports = subscriptions;
