const listBorrowersRoute = require("./list");
const impersonateBorrowerRoute = require("./impersonate");
const updateBorrowerIdentityRoute = require("./updateIdentity");
const checkBorrowerEmailRoute = require("./checkEmail");

module.exports = async function brokerBorrowersRoutes(fastify) {
  fastify.register(impersonateBorrowerRoute);
  fastify.register(listBorrowersRoute);
  fastify.register(updateBorrowerIdentityRoute);
  fastify.register(checkBorrowerEmailRoute);
};
