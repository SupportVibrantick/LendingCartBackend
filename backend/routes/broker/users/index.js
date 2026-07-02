const createUserRoute = require("./create");
const listUserRoute = require("./list");
const getByIdUserRoute = require("./getById");
const deleteUserRoute = require("./delete");
const statusUserRoute = require("./status");
const updateUserRoute = require("./update");
const impersonateUserRoute = require("./impersonate");
const coBrokersRoute = require("./coBrokers");

module.exports = async function brokerUserRoutes(fastify) {
  fastify.register(coBrokersRoute);
  fastify.register(createUserRoute);
  fastify.register(listUserRoute);
  fastify.register(impersonateUserRoute);
  fastify.register(getByIdUserRoute);
  fastify.register(deleteUserRoute);
  fastify.register(statusUserRoute);
  fastify.register(updateUserRoute);
};