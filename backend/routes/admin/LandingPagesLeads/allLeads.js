module.exports = async function (fastify) {
  fastify.get("/", async (req, reply) => {
    const prisma = fastify.prisma;

    const { page = 1, limit = 20, status, q, source } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const baseWhere = {
      ...(status && { status }),
      ...(q && {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      }),
    };

    const tasks = [];

    // Commercial Lending Mastery
    if (!source || source === "commerciallendingmastery") {
      tasks.push(
        prisma.commercialLendingMasteryLead.findMany({
          where: baseWhere,
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
        prisma.commercialLendingMasteryLead.count({ where: baseWhere })
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    // CLM Landing Page
    if (!source || source === "clmlandingpage") {
      tasks.push(
        prisma.clmLandingPageLead.findMany({
          where: baseWhere,
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
        prisma.clmLandingPageLead.count({ where: baseWhere })
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    // Admin Manual
    if (!source || source === "Admin") {
      tasks.push(
        prisma.adminManualLead.findMany({
          where: baseWhere,
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
        prisma.adminManualLead.count({ where: baseWhere })
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    // Loan AI Book Demo
    if (!source || source === "loan-ai-book-demo") {
      tasks.push(
        prisma.loanAiBookDemoLead.findMany({
          where: baseWhere,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
            message: true,
            status: true,
            source: true,
            createdAt: true,
          },
        }),
        prisma.loanAiBookDemoLead.count({ where: baseWhere })
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    const [
      clmLeads, clmCount,
      landingLeads, landingCount,
      adminLeads, adminCount,
      bookDemoLeads, bookDemoCount,
    ] = await Promise.all(tasks);

    const merged = [
      ...clmLeads.map(l => ({ ...l, leadType: "COMMERCIAL_LENDING_MASTERY" })),
      ...landingLeads.map(l => ({ ...l, leadType: "CLM_LANDING_PAGE" })),
      ...adminLeads.map(l => ({ ...l, leadType: "ADMIN_MANUAL" })),
      ...bookDemoLeads.map(l => ({ ...l, leadType: "LOAN_AI_BOOK_DEMO" })),
    ];

    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paginated = merged.slice(skip, skip + take);

    return reply.send({
      success: true,
      meta: {
        page: Number(page),
        limit: take,
        total: clmCount + landingCount + adminCount + bookDemoCount,
      },
      data: paginated,
    });
  });
};