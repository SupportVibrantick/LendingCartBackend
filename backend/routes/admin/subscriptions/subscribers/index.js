const listRoutes = require("./list");
const detailRoutes = require("./detail");
const assignRoutes = require("./assign");
const changePlanRoutes = require("./changePlan");
const cancelRoutes = require("./cancel");
const refreshUsageRoutes = require("./refreshUsage");
const processBillingRoutes = require("./processBilling");

async function subscribersRoutes(fastify) {
  fastify.register(listRoutes, { prefix: "/read" });
  fastify.register(detailRoutes);
  fastify.register(assignRoutes, { prefix: "/assign" });
  fastify.register(changePlanRoutes, { prefix: "/change-plan" });
  fastify.register(cancelRoutes, { prefix: "/cancel" });
  fastify.register(refreshUsageRoutes, { prefix: "/refresh-usage" });
  fastify.register(processBillingRoutes, { prefix: "/process-billing" });
}

module.exports = subscribersRoutes;
