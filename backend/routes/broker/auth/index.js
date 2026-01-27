const login = require("./login");
const register = require("./register");
// const me = require("./me");

async function lenderAuthRoutes(fastify) {
  fastify.register(login, { prefix: "/login" });
  fastify.register(register, { prefix: "/register" });
//   fastify.register(me);
}

module.exports = lenderAuthRoutes;
