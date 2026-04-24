/**
 * Broker Applications Routes
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerApplicationsRoutes(fastify) {
  // ─────────────────────────────────────────────
  // Application (container)
  // ─────────────────────────────────────────────
  fastify.register(require("./createApplication"));
  fastify.register(require("./listApplications"));
  fastify.register(require("./updateApplicationStatus"));
  fastify.register(require("./activeApplication"));
  fastify.register(require("./updateApplication"));

  
  fastify.register(require("./brokerSubmitApplication"));
  fastify.register(require("./editSubmittedApplication"));
  // ─────────────────────────────────────────────
  // Application → Products (admin-approved only)
  // ─────────────────────────────────────────────
  fastify.register(require("./products/addProduct"));
  fastify.register(require("./products/listProducts"));
  fastify.register(require("./products/removeProduct"));

  fastify.register(require("./sections"), {
    prefix: "/products/:productId/sections",
  });

  // ─────────────────────────────────────────────
  // Application → Product Fields
  // ─────────────────────────────────────────────
  fastify.register(require("./fields/addField"));
  fastify.register(require("./fields/updateField"));
  fastify.register(require("./fields/deleteField"));
  fastify.register(require("./fields/listFields"));

  fastify.register(require("./createFromTemplate"));

  fastify.register(require("./assignLoanOfficer"));

  
}

module.exports = brokerApplicationsRoutes;