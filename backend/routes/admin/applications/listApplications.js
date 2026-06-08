module.exports = async function listApplications(fastify) {
  fastify.get("/", async (req, reply) => {
    const brokerOrgId = req.query.brokerOrgId;

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId query parameter is required",
      });
    }

    const apps = await fastify.prisma.brokerApplication.findMany({
      where: { brokerOrgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdFromTemplate: true,
        createdAt: true,
      },
    });

    reply.send({ success: true, data: apps });
  });
};
