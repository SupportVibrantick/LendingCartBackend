// backend/routes/index.js
const adminRoutes = require("../routes/admin"); // adjust path if needed

async function indexRoutes(fastify, options) {
  // GET route for the index page
  fastify.get("/", async (request, reply) => {
    request.log.info("Home page accessed");
    return reply.view("index.pug", {
      title: "Welcome to LendingCart Server",
      message: "A self-hosted application server",
    });
  });

  fastify.register(adminRoutes, { prefix: "/admin" });
}

module.exports = indexRoutes;
