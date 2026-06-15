const { formatAdminClientRow } = require("../../../services/formatAdminClientRow");

async function listClients(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Clients"],
        summary: "List all clients platform-wide",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const q = req.query || {};
      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "20", 10), 1), 100);
      const skip = (page - 1) * limit;
      const search = q.search?.trim();

      const where = { isDeleted: { not: true } };

      if (q.brokerOrgId) where.primaryBrokerOrgId = q.brokerOrgId;
      if (q.isActive === "true") where.isActive = true;
      if (q.isActive === "false") where.isActive = false;
      if (search) {
        where.OR = [
          { legalName: { contains: search, mode: "insensitive" } },
          { contacts: { some: { email: { contains: search, mode: "insensitive" } } } },
          {
            contacts: {
              some: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ];
      }

      const brokerOrgId = q.brokerOrgId?.trim();
      const applicationsCountWhere = brokerOrgId ? { brokerOrgId } : undefined;

      const [rows, total] = await prisma.$transaction([
        prisma.client.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            legalName: true,
            entityType: true,
            industry: true,
            isActive: true,
            createdAt: true,
            primaryBrokerOrgId: true,
            primaryBroker: { select: { id: true, name: true, status: true } },
            contacts: {
              orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
              select: {
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                isPrimary: true,
              },
            },
            loanApplications: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                submissions: {
                  orderBy: { createdAt: "desc" },
                  include: {
                    fields: {
                      include: {
                        builderField: { select: { fieldKey: true } },
                      },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                loanApplications: applicationsCountWhere
                  ? { where: applicationsCountWhere }
                  : true,
                portalUsers: true,
              },
            },
          },
        }),
        prisma.client.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: rows.map(formatAdminClientRow),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );
}

module.exports = listClients;
