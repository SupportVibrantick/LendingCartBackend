const createSection = require("./createSections");
const allSections = require("./allSections");

module.exports = async function templateSectionsRoutes(fastify) {
  fastify.register(createSection);
  fastify.register(allSections);
};
