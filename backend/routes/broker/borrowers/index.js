const listBorrowersRoute = require("./list");
const impersonateBorrowerRoute = require("./impersonate");

module.exports = async function brokerBorrowersRoutes(fastify) {
  fastify.register(impersonateBorrowerRoute);
  fastify.register(listBorrowersRoute);
};
