module.exports = async function listApplications(fastify) {
  fastify.get("/", async (req, reply) => {
    const { brokerOrgId } = req.query;

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    const apps = await fastify.prisma.brokerApplication.findMany({
      where: { brokerOrgId },
      orderBy: { createdAt: "desc" },
    });

    reply.send({ success: true, data: apps });
  });
};
