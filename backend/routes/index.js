const { adminLogs } = require("../services/logger/contextLogger");

// routes/index.js
async function indexRoutes(fastify, options) {
  // GET route for the index page
  fastify.get("/", async (request, reply) => {
    request.log.info("Home page accessed");
    return reply.view("index.pug", {
      title: "Home Page",
      message: "Welcome to Lending Cart!",
    });
  });
}

module.exports = indexRoutes;