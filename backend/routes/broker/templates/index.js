/**
 * Broker Templates Routes (Read-Only)
 * Mounted at: /broker/templates
 */
async function brokerTemplateRoutes(fastify) {
  // List all active templates for broker
  fastify.register(require("./listTemplates"));
  fastify.register(require("./getTemplateDetails"));
}

module.exports = brokerTemplateRoutes;
