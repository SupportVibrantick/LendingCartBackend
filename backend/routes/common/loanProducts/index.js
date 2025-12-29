const loanProducts = require("./loanProducts");

async function commonLoanProductRoutes(fastify) {
  fastify.register(loanProducts, { prefix: "/" });
}

module.exports = commonLoanProductRoutes;
