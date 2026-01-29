const createSection = require("./createSection");
const allSections = require("./allSections");

module.exports = async function applicationSectionRoutes(fastify) {
  fastify.register(createSection);
  fastify.register(allSections);
};
