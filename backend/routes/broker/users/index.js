const createUserRoute = require("./create");
const listUserRoute = require("./list");
const deleteUserRoute = require("./delete");
const statusUserRoute = require("./status");

module.exports = async function brokerUserRoutes(fastify) {
  fastify.register(createUserRoute);
  fastify.register(listUserRoute);
  fastify.register(deleteUserRoute);
  fastify.register(statusUserRoute);
};