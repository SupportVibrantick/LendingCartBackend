const readRoutes = require("./read");
const createRoutes = require("./create");
const deleteRoutes = require("./status");
const updateRoutes = require("./update");

async function brokersRoutes(fastify, options) {
  fastify.register(createRoutes, { prefix: "/create" });
  fastify.register(readRoutes, { prefix: "/read" });
  fastify.register(deleteRoutes, { prefix: "/status" });
  fastify.register(updateRoutes, { prefix: "/update" } );
  fastify.register(require("./contacts"), { prefix: "/contacts" });
  fastify.register(require("./loanOfficers"), { prefix: "/loan-officers" });
  fastify.register(require("./loanOfficerActivity"), { prefix: "/loan-officer-activity" });
  fastify.register(require("./subBrokers"), { prefix: "/sub-brokers" });
  fastify.register(require("./lenders"), { prefix: "/lenders" });
}

module.exports = brokersRoutes;
