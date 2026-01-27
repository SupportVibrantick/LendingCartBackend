module.exports = async function listTemplates(fastify) {
  fastify.get("/", async (_req, reply) => {
    const templates = await fastify.prisma.applicationTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    reply.send({ success: true, data: templates });
  });
};
