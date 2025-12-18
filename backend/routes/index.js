// backend/routes/index.js
const adminRoutes = require("../routes/admin");
const lenderRoutes = require("../routes/lender");

async function indexRoutes(fastify, options) {
  fastify.get("/", async (request, reply) => {
    request.log.info("Home page accessed");
    return reply.view("index.pug", {
      title: "Welcome to LendingCart Server",
      message: "A self-hosted application server",
    });
  });

  fastify.register(adminRoutes, { prefix: "/admin" });
  fastify.register(lenderRoutes, { prefix: "/lender" });
}

module.exports = indexRoutes;
