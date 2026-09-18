// backend/routes/broker/stats/list.js

const {
  ANALYTICS_APPLICATION_SELECT,
  createAnalyticsEngine,
} = require("../../../utils/broker/dashboardPeriodAnalytics");

module.exports = async function brokerStatsList(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Stats"],
        summary: "Get broker dashboard statistics",
        querystring: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["7d", "30d", "90d", "12m"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;
        const roles = req.user.roles || [];

        const isAdmin = roles.includes("BROKER_ADMIN");
        const isOfficer = roles.includes("BROKER_OFFICER");
        const isSubBroker = roles.includes("SUB_BROKER");

        if (!isAdmin && !isOfficer && !isSubBroker) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        if (!brokerOrgId) {
          return reply.code(400).send({
            success: false,
            message: "Invalid broker organization",
          });
        }

        const engine = createAnalyticsEngine(req.query?.period);
        const { period, previousPeriod } = engine;

        const applicationWhere = {
          brokerOrgId,
          OR: [
            {
              createdAt: {
                gte: previousPeriod.start,
                lte: period.end,
              },
            },
            {
              submittedAt: {
                gte: previousPeriod.start,
                lte: period.end,
              },
            },
            {
              fundedAt: {
                gte: previousPeriod.start,
                lte: period.end,
              },
            },
          ],
          ...(isOfficer && {
            brokerUserId: userId,
          }),
          ...(isSubBroker && {
            subBrokerAssignments: {
              some: {
                subBrokerId: userId,
              },
            },
          }),
        };

        const BATCH_SIZE = 500;
        let cursorId = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const batch = await prisma.loanApplication.findMany({
            where: applicationWhere,
            take: BATCH_SIZE,
            ...(cursorId
              ? {
                  skip: 1,
                  cursor: { id: cursorId },
                }
              : {}),
            orderBy: { id: "asc" },
            select: ANALYTICS_APPLICATION_SELECT,
          });

          if (!batch.length) break;

          for (const application of batch) {
            engine.add(application);
          }

          cursorId = batch[batch.length - 1].id;
          if (batch.length < BATCH_SIZE) break;
        }

        return reply.send({
          success: true,
          data: engine.finalize(),
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            brokerOrgId: req.user?.organizationId,
          },
          "Broker stats fetch failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching broker stats",
        });
      }
    },
  );
};
