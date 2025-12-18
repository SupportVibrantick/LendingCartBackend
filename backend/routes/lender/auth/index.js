const login = require("./login");
const register = require("./register");

async function lenderAuthRoutes(fastify) {
  fastify.register(login, { prefix: "/login" });
  fastify.register(register, { prefix: "/register" });
}

module.exports = lenderAuthRoutes;
