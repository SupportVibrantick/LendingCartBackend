const { formatAdminClientRow } = require("../../../services/applications/formatAdminClientRow");

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
      const { skip, take, page, limit } = require("../../utils/pagination").parsePagination(req.query);
      const search = req.query.search?.trim();

      const where = { isDeleted: { not: true } };

      if (req.query.brokerOrgId) where.primaryBrokerOrgId = req.query.brokerOrgId;
      if (req.query.isActive === "true") where.isActive = true;
      if (req.query.isActive === "false") where.isActive = false;
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

      const brokerOrgId = req.query.brokerOrgId?.trim();
      const applicationsCountWhere = brokerOrgId ? { brokerOrgId } : undefined;

      const [rows, total] = await prisma.$transaction([
        prisma.client.findMany({
          where,
          skip,
          take,
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
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: rows.length === limit,
        },
      });
    },
  );
}

module.exports = listClients;
