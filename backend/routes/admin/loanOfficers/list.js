async function listLoanOfficers(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Officers"],
        summary: "List all loan officers platform-wide",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const q = req.query || {};
      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "20", 10), 1), 100);
      const skip = (page - 1) * limit;
      const search = q.search?.trim();

      const where = {
        isDeleted: false,
        roles: { some: { role: { name: "BROKER_OFFICER" } } },
      };

      if (q.brokerOrgId) where.organizationId = q.brokerOrgId;
      if (q.status) where.status = q.status;
      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await prisma.$transaction([
        prisma.userAccount.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
            organizationId: true,
            organization: { select: { id: true, name: true, status: true } },
            _count: {
              select: { brokerLoanApplications: true },
            },
          },
        }),
        prisma.userAccount.count({ where }),
      ]);

      const officerIds = rows.map((row) => row.id);
      let lastActivityMap = new Map();

      if (officerIds.length > 0 && q.brokerOrgId) {
        const lastLogRows = await prisma.auditLog.groupBy({
          by: ["actorUserId"],
          where: {
            actorOrgId: q.brokerOrgId,
            dashboard: "BROKER",
            actorUserId: { in: officerIds },
          },
          _max: { createdAt: true },
        });

        lastActivityMap = new Map(
          lastLogRows.map((row) => [row.actorUserId, row._max.createdAt]),
        );
      }

      return reply.send({
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone,
          status: row.status,
          lastLoginAt: row.lastLoginAt,
          createdAt: row.createdAt,
          brokerOrgId: row.organizationId,
          brokerName: row.organization?.name || null,
          brokerStatus: row.organization?.status || null,
          assignedDeals: row._count.brokerLoanApplications,
          lastActivityAt: lastActivityMap.get(row.id) || null,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );
}

module.exports = listLoanOfficers;
