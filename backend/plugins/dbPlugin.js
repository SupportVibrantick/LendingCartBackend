const fp = require("fastify-plugin");
const prisma = require("../prisma/client");

module.exports = fp(async function dbPlugin(fastify) {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
