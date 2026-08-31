module.exports = async function listApplications(fastify) {
  const { parsePagination } = require("../../utils/pagination");

  fastify.get("/", async (req, reply) => {
    const { skip, take, page, limit } = parsePagination(req.query);

    const [total, apps] = await Promise.all([
      fastify.prisma.brokerApplication.count({
        where: { brokerOrgId: req.user.organizationId },
      }),
      fastify.prisma.brokerApplication.findMany({
        where: { brokerOrgId: req.user.organizationId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    reply.send({
      success: true,
      data: apps,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: apps.length === limit,
      },
    });
  });
};
