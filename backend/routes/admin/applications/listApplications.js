module.exports = async function listApplications(fastify) {
  fastify.get("/", async (req, reply) => {
    const brokerOrgId = req.query.brokerOrgId;

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId query parameter is required",
      });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const [total, apps] = await Promise.all([
      fastify.prisma.brokerApplication.count({ where: { brokerOrgId } }),
      fastify.prisma.brokerApplication.findMany({
        where: { brokerOrgId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          isActive: true,
          createdFromTemplate: true,
          createdAt: true,
        },
      }),
    ]);

    reply.send({
      success: true,
      data: apps,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });
};
