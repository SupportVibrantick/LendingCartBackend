const listLoiRoute = require("./listLoi");

async function loiRoutes(fastify, options) {
  fastify.register(listLoiRoute);
}

module.exports = loiRoutes;
