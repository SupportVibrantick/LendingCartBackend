module.exports = async function (fastify) {
  fastify.get("/", async (req, reply) => {
    const prisma = fastify.prisma;

    const {
      page = 1,
      limit = 20,
      status,
      q,
      source,
      ghlSyncStatus,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const search = typeof q === "string" ? q.trim() : "";

    const baseWhere = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const bookDemoWhere = {
      ...baseWhere,
      ...(ghlSyncStatus && { ghlSyncStatus }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
          { interestedPlanName: { contains: search, mode: "insensitive" } },
          { interestedPlanCode: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const adminWhere = {
      ...baseWhere,
      ...(ghlSyncStatus && { ghlSyncStatus }),
    };

    // GHL status filter only applies to Admin + Book Demo (models with GHL fields)
    const includeClm =
      !ghlSyncStatus && (!source || source === "commerciallendingmastery");
    const includeLanding =
      !ghlSyncStatus && (!source || source === "clmlandingpage");
    const includeAdmin = !source || source === "Admin";
    const includeBookDemo = !source || source === "loan-ai-book-demo";

    const tasks = [];

    if (includeClm) {
      tasks.push(
        prisma.commercialLendingMasteryLead.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: take,
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
        prisma.commercialLendingMasteryLead.count({ where: baseWhere }),
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    if (includeLanding) {
      tasks.push(
        prisma.clmLandingPageLead.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: take,
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
        prisma.clmLandingPageLead.count({ where: baseWhere }),
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    if (includeAdmin) {
      tasks.push(
        prisma.adminManualLead.findMany({
          where: adminWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: take,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            source: true,
            campaign: true,
            ghlSyncStatus: true,
            ghlContactId: true,
            ghlSyncedAt: true,
            ghlLastError: true,
            createdAt: true,
          },
        }),
        prisma.adminManualLead.count({ where: adminWhere }),
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    if (includeBookDemo) {
      tasks.push(
        prisma.loanAiBookDemoLead.findMany({
          where: bookDemoWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: take,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
            message: true,
            interestedPlanCode: true,
            interestedPlanName: true,
            status: true,
            source: true,
            ghlSyncStatus: true,
            ghlContactId: true,
            ghlSyncedAt: true,
            ghlLastError: true,
            createdAt: true,
          },
        }),
        prisma.loanAiBookDemoLead.count({ where: bookDemoWhere }),
      );
    } else {
      tasks.push(Promise.resolve([]), Promise.resolve(0));
    }

    const [
      clmLeads,
      clmCount,
      landingLeads,
      landingCount,
      adminLeads,
      adminCount,
      bookDemoLeads,
      bookDemoCount,
    ] = await Promise.all(tasks);

    const merged = [
      ...clmLeads.map((l) => ({ ...l, leadType: "COMMERCIAL_LENDING_MASTERY" })),
      ...landingLeads.map((l) => ({ ...l, leadType: "CLM_LANDING_PAGE" })),
      ...adminLeads.map((l) => ({ ...l, leadType: "ADMIN_MANUAL" })),
      ...bookDemoLeads.map((l) => ({ ...l, leadType: "LOAN_AI_BOOK_DEMO" })),
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
