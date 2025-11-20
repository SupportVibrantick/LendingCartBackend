const { adminLogs } = require("../services/logger/contextLogger");
const adminRoutes = require("./admin");
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

  fastify.register(adminRoutes, { prefix: "/admin" });
}


 

module.exports = indexRoutes;