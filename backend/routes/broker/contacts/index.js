const createContactRoute = require("./create");
const listContactRoute = require("./list");
const deleteContactRoute = require("./delete");
// const statusUserRoute = require("./status");
const updateContactRoute = require("./update");

module.exports = async function brokerUserRoutes(fastify) {
  fastify.register(createContactRoute);
  fastify.register(listContactRoute);
  fastify.register(deleteContactRoute);
//   fastify.register(statusUserRoute);
  fastify.register(updateContactRoute);
};