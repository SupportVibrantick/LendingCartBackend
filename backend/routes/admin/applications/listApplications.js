module.exports = async function listApplications(fastify) {
  fastify.get("/", async (req, reply) => {
    const brokerOrgId = req.user.organizationId;

    const apps = await fastify.prisma.brokerApplication.findMany({
      where: { brokerOrgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdFromTemplate: true,
        templateId: true,
        createdAt: true,
      },
    });

    reply.send({ success: true, data: apps });
  });
};
