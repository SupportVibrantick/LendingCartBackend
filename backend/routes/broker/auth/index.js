const login = require("./login");
const register = require("./register");
const me = require("./me");
const updateProfile = require("./updateProfile");

async function lenderAuthRoutes(fastify) {
  fastify.register(login, { prefix: "/login" });
  fastify.register(register, { prefix: "/register" });
  fastify.register(me,{prefix:"/me"});
  fastify.register(updateProfile,{prefix:"/update"});
}

module.exports = lenderAuthRoutes;
