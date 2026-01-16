module.exports = async function listApplications(fastify) {
  fastify.get("/", async (req, reply) => {
    const apps = await fastify.prisma.brokerApplication.findMany({
      where: { brokerOrgId: req.user.organizationId },
      orderBy: { createdAt: "desc" },
    });

    reply.send({ success: true, data: apps });
  });
};
