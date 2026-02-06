module.exports = async function (fastify) {
  fastify.get("/manual-leads", async (req, reply) => {
    const prisma = fastify.prisma;
    const { page = 1, limit = 20, status } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      prisma.adminManualLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.adminManualLead.count({ where }),
    ]);

    return reply.send({
      success: true,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
      },
      data,
    });
  });
};