const listBorrowersRoute = require("./list");

module.exports = async function brokerBorrowersRoutes(fastify) {
  fastify.register(listBorrowersRoute);
};
