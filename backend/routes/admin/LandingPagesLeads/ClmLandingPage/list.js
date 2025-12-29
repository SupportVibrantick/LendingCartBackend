const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async function (fastify) {
  fastify.get("/", async (req, reply) => {
    const { page = 1, limit = 20, status } = req.query;

    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      prisma.clmLandingPageLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: Number(skip),
        take: Number(limit),
      }),
      prisma.clmLandingPageLead.count({ where }),
    ]);

    return reply.send({
      success: true,
      meta: { page: Number(page), limit: Number(limit), total },
      data,
    });
  });
};
