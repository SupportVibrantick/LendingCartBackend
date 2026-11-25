const {
  findApplicationIdsBySubmissionFieldSearch,
  EMAIL_FIELD_KEYS,
} = require("../../../services/applications/loanApplicationSearch");
const {
  groupBorrowersByEmail,
} = require("../../../services/broker/groupBorrowersByEmail");

module.exports = async function subBrokerListBorrowersRoute(fastify) {
  fastify.get(
    "/list",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Borrowers"],
        summary:
          "List assigned borrowers grouped by email/client portal, with nested applications",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" },
            sortBy: {
              type: "string",
              enum: [
                "name",
                "email",
                "phone",
                "applicationNumber",
                "createdAt",
              ],
              default: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const subBrokerId = req.user.id || req.user.userId;
        const brokerOrgId = req.user.organizationId;

        if (!subBrokerId || !brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized access",
          });
        }

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const search = (req.query.search || "").trim();
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

        const submissionEmailMatchIds = search
          ? await findApplicationIdsBySubmissionFieldSearch(prisma, search, {
              fieldKeys: EMAIL_FIELD_KEYS,
              keyPattern: "(email)$",
              matchDigits: false,
            })
          : [];

        const where = {
          brokerOrgId,
          subBrokerAssignments: {
            some: { subBrokerId },
          },
          ...(search
            ? {
                OR: [
                  {
                    applicationNumber: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    client: {
                      legalName: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    client: {
                      contacts: {
                        some: {
                          OR: [
                            {
                              firstName: {
                                contains: search,
                                mode: "insensitive",
                              },
                            },
                            {
                              lastName: {
                                contains: search,
                                mode: "insensitive",
                              },
                            },
                            {
                              email: { contains: search, mode: "insensitive" },
                            },
                            {
                              phone: { contains: search, mode: "insensitive" },
                            },
                          ],
                        },
                      },
                    },
                  },
                  {
                    client: {
                      portalUsers: {
                        some: {
                          isDeleted: { not: true },
                          email: { contains: search, mode: "insensitive" },
                        },
                      },
                    },
                  },
                  ...(submissionEmailMatchIds.length
                    ? [{ id: { in: submissionEmailMatchIds } }]
                    : []),
                ],
              }
            : {}),
        };

        const applications = await prisma.loanApplication.findMany({
          where,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            createdAt: true,
            client: {
              select: {
                id: true,
                legalName: true,
                contacts: {
                  orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    isPrimary: true,
                  },
                },
                portalUsers: {
                  where: { isDeleted: { not: true }, isActive: true },
                  orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
                  take: 1,
                  select: { email: true },
                },
              },
            },
            submissions: {
              where: { status: { not: "SUPERSEDED" } },
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                createdAt: true,
                fields: {
                  select: {
                    fieldKey: true,
                    value: true,
                    builderField: {
                      select: { fieldKey: true },
                    },
                  },
                },
              },
            },
          },
        });

        const result = groupBorrowersByEmail(applications, {
          page,
          limit,
          sortBy,
          sortOrder,
        });

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching borrowers",
        });
      }
    },
  );
};
