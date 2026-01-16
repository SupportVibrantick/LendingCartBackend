module.exports = async function createApplication(fastify) {
  fastify.post("/", async (req, reply) => {
    const { name } = req.body;

    const app = await fastify.prisma.brokerApplication.create({
      data: {
        brokerOrgId: req.user.organizationId,
        name,
        isActive: false,
      },
    });

    reply.send({ success: true, data: app });
  });
};
