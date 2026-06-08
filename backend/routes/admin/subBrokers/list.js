async function listSubBrokers(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Sub-Brokers"],
        summary: "List all sub-brokers platform-wide",
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
        roles: { some: { role: { name: "SUB_BROKER" } } },
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
              select: { assignedApplications: true },
            },
          },
        }),
        prisma.userAccount.count({ where }),
      ]);

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
          assignedApplications: row._count.assignedApplications,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );
}

module.exports = listSubBrokers;
