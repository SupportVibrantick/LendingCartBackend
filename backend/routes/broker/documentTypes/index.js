const listRoutes = require("./list");
const createRoutes = require("./create");
const updateRoutes = require("./update");
const deactivateRoutes = require("./deactivate");

module.exports = async function brokerDocumentTypesRoutes(fastify) {
  fastify.register(listRoutes);
  fastify.register(createRoutes);
  fastify.register(updateRoutes);
  fastify.register(deactivateRoutes);
};
