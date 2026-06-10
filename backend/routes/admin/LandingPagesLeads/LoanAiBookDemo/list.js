module.exports = async function (fastify) {
  fastify.get("/", async (req, reply) => {
    const prisma = fastify.prisma;
    const { page = 1, limit = 20, status, q } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {
      ...(status && { status }),
      ...(q && {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.loanAiBookDemoLead.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.loanAiBookDemoLead.count({ where }),
    ]);

    return reply.send({
      success: true,
      meta: { page: Number(page), limit: take, total },
      data,
    });
  });
};
