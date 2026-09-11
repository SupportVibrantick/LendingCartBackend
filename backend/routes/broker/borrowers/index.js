const listBorrowersRoute = require("./list");
const impersonateBorrowerRoute = require("./impersonate");
const updateBorrowerIdentityRoute = require("./updateIdentity");

module.exports = async function brokerBorrowersRoutes(fastify) {
  fastify.register(impersonateBorrowerRoute);
  fastify.register(listBorrowersRoute);
  fastify.register(updateBorrowerIdentityRoute);
};
