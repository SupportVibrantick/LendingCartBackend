module.exports = async function (fastify) {
  fastify.get("/", async (req, reply) => {
    const prisma = fastify.prisma;
    const { page = 1, limit = 20, status } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = status ? { status } : {};

    const [
      clmLeads,
      landingLeads,
      adminLeads,

      clmCount,
      landingCount,
      adminCount,
    ] = await Promise.all([
      prisma.commercialLendingMasteryLead.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          campaign: true,
          createdAt: true,
        },
      }),
      prisma.clmLandingPageLead.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          campaign: true,
          createdAt: true,
        },
      }),
      prisma.adminManualLead.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          campaign: true,
          createdAt: true,
        },
      }),

      prisma.commercialLendingMasteryLead.count({ where }),
      prisma.clmLandingPageLead.count({ where }),
      prisma.adminManualLead.count({ where }),
    ]);

    // Normalize + tag source table
    const merged = [
      ...clmLeads.map(l => ({ ...l, leadType: "COMMERCIAL_LENDING_MASTERY" })),
      ...landingLeads.map(l => ({ ...l, leadType: "CLM_LANDING_PAGE" })),
      ...adminLeads.map(l => ({ ...l, leadType: "ADMIN_MANUAL" })),
    ];

    // Sort by createdAt DESC
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination AFTER merge
    const paginated = merged.slice(skip, skip + take);

    const total =
      clmCount + landingCount + adminCount;

    return reply.send({
      success: true,
      meta: {
        page: Number(page),
        limit: take,
        total,
      },
      data: paginated,
    });
  });
};