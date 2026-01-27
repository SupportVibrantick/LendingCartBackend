const login = require("./login");
const register = require("./register");
const me = require("./me");
const updateProfileRoutes = require("./updateProfile");
async function lenderAuthRoutes(fastify) {
  fastify.register(login, { prefix: "/login" });
  fastify.register(register, { prefix: "/register" });
  fastify.register(me);
  fastify.register(updateProfileRoutes);
}

module.exports = lenderAuthRoutes;
