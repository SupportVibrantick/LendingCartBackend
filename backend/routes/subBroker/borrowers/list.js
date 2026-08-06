const {
  resolveClientDisplayNameFromData,
  resolveClientEmailFromData,
  resolveClientPhoneFromData,
} = require("../../../services/messaging/resolveClientDisplayName");

function getLatestSubmission(submissions = []) {
  const active = submissions.filter((s) => s.status !== "SUPERSEDED");
  if (!active.length) return null;
  return active.reduce((latest, current) =>
    !latest || new Date(current.createdAt) > new Date(latest.createdAt)
      ? current
      : latest,
  );
}

module.exports = async function subBrokerListBorrowersRoute(fastify) {
  fastify.get(
    "/list",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Borrowers"],
        summary: "List borrowers from co-broker assigned applications",
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
        const skip = (page - 1) * limit;

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
                ],
              }
            : {}),
        };

        let orderBy;
        switch (sortBy) {
          case "name":
            orderBy = { client: { legalName: sortOrder } };
            break;
          case "applicationNumber":
            orderBy = { applicationNumber: sortOrder };
            break;
          case "email":
          case "phone":
            orderBy = [
              { client: { legalName: sortOrder } },
              { createdAt: sortOrder },
            ];
            break;
          default:
            orderBy = { createdAt: sortOrder };
        }

        const [applications, total] = await prisma.$transaction([
          prisma.loanApplication.findMany({
            where,
            orderBy,
            skip,
            take: limit,
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
          }),
          prisma.loanApplication.count({ where }),
        ]);

        const data = applications.map((app) => {
          const submissions = app.submissions || [];
          const latestSubmission = getLatestSubmission(submissions);

          return {
            id: app.id,
            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            applicationStatus: app.status,
            submissionId: latestSubmission?.id || null,
            clientId: app.client?.id || null,
            name: resolveClientDisplayNameFromData(app.client, submissions),
            email: resolveClientEmailFromData(app.client, submissions) || "",
            phone: resolveClientPhoneFromData(app.client, submissions) || "",
            createdAt: app.createdAt,
          };
        });

        return reply.send({
          success: true,
          data,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          },
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
