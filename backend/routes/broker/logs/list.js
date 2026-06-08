module.exports = async function listBrokerLogs(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Logs"],
        summary: "List broker activity logs",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            category: {
              type: "string",
              enum: [
                "SECURITY",
                "USER_MANAGEMENT",
                "APPLICATION",
                "REVIEW",
                "SYSTEM"
              ]
            },
            action: { type: "string" },
            officerId: { type: "string" },
            loanOfficersOnly: { type: "boolean", default: false },
            fromDate: { type: "string", format: "date-time" },
            toDate: { type: "string", format: "date-time" }
          }
        }
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* =====================================
           1️⃣ AUTHORIZATION
        ====================================== */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can view logs"
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* =====================================
           2️⃣ QUERY PARAMS
        ====================================== */

        const {
          page = 1,
          limit = 10,
          category,
          action,
          officerId,
          loanOfficersOnly,
          fromDate,
          toDate
        } = req.query;

        const skip = (page - 1) * limit;

        /* =====================================
           3️⃣ BUILD FILTER
        ====================================== */

        const where = {
          actorOrgId: brokerOrgId,
          dashboard: "BROKER"
        };

        if (category) {
          where.category = category;
        }

        if (action) {
          where.action = {
            contains: action,
            mode: "insensitive"
          };
        }

        if (fromDate || toDate) {
          where.createdAt = {};
          if (fromDate) where.createdAt.gte = new Date(fromDate);
          if (toDate) where.createdAt.lte = new Date(toDate);
        }

        if (officerId) {
          where.actorUserId = officerId;
        } else if (
          loanOfficersOnly === true ||
          loanOfficersOnly === "true"
        ) {
          where.actorUser = {
            roles: {
              some: { role: { name: "BROKER_OFFICER" } },
            },
          };
        }

        /* =====================================
           4️⃣ FETCH LOGS + COUNT
        ====================================== */

        const [logs, total] = await prisma.$transaction([
          prisma.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
              actorUser: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  roles: {
                    select: {
                      role: { select: { name: true } },
                    },
                  },
                }
              }
            }
          }),
          prisma.auditLog.count({ where })
        ]);

        /* =====================================
           5️⃣ FORMAT RESPONSE
        ====================================== */

        const formattedLogs = logs.map(log => ({
          id: log.id,
          category: log.category,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          performedBy: log.actorUser
            ? {
                id: log.actorUser.id,
                email: log.actorUser.email,
                name: `${log.actorUser.firstName ?? ""} ${log.actorUser.lastName ?? ""}`.trim(),
                roles: log.actorUser.roles?.map((r) => r.role?.name).filter(Boolean) || [],
              }
            : null,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
          oldValue: log.oldValueJson ? JSON.parse(log.oldValueJson) : null,
          newValue: log.newValueJson ? JSON.parse(log.newValueJson) : null
        }));

        /* =====================================
           6️⃣ SUCCESS RESPONSE
        ====================================== */

        return reply.send({
          success: true,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          data: formattedLogs
        });

      } catch (error) {
        fastify.log.error(
          { error: error.message, orgId: req.user?.organizationId },
          "Failed to fetch broker logs"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching logs"
        });
      }
    }
  );
};