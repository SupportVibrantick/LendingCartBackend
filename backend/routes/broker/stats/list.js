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

        const officerRoleWhere = {
          organizationId: brokerOrgId,
          isDeleted: false,
          roles: { some: { role: { name: "BROKER_OFFICER" } } },
        };
        const coBrokerRoleWhere = {
          organizationId: brokerOrgId,
          isDeleted: false,
          roles: { some: { role: { name: "SUB_BROKER" } } },
        };
        const borrowerAppWhere = {
          brokerOrgId,
          ...(isOfficer && { brokerUserId: userId }),
          ...(isSubBroker && {
            subBrokerAssignments: { some: { subBrokerId: userId } },
          }),
        };

        const [
          lendersConnected,
          lendersInactive,
          officersTotal,
          officersActive,
          officersDisabled,
          coBrokersTotal,
          coBrokersActive,
          coBrokersDisabled,
          contactsTotal,
          contactTypeRows,
          borrowersTotal,
          borrowersPortalReady,
          borrowersPendingLink,
          clientsTotal,
          topOfficerRows,
        ] = await Promise.all([
          prisma.brokerLenderAccess.count({
            where: { brokerOrgId, isActive: true },
          }),
          prisma.brokerLenderAccess.count({
            where: { brokerOrgId, isActive: false },
          }),
          prisma.userAccount.count({ where: officerRoleWhere }),
          prisma.userAccount.count({
            where: { ...officerRoleWhere, status: "ACTIVE" },
          }),
          prisma.userAccount.count({
            where: { ...officerRoleWhere, status: "DISABLED" },
          }),
          prisma.userAccount.count({ where: coBrokerRoleWhere }),
          prisma.userAccount.count({
            where: { ...coBrokerRoleWhere, status: "ACTIVE" },
          }),
          prisma.userAccount.count({
            where: { ...coBrokerRoleWhere, status: "DISABLED" },
          }),
          prisma.contact.count({
            where: { brokerOrgId, isDeleted: false },
          }),
          prisma.contact.groupBy({
            by: ["contactType"],
            where: { brokerOrgId, isDeleted: false },
            _count: { _all: true },
          }),
          prisma.loanApplication.count({ where: borrowerAppWhere }),
          prisma.loanApplication.count({
            where: { ...borrowerAppWhere, clientId: { not: null } },
          }),
          prisma.loanApplication.count({
            where: { ...borrowerAppWhere, clientId: null },
          }),
          prisma.client.count({
            where: {
              primaryBrokerOrgId: brokerOrgId,
              OR: [{ isDeleted: false }, { isDeleted: null }],
            },
          }),
          prisma.loanApplication.groupBy({
            by: ["brokerUserId"],
            where: {
              brokerOrgId,
              brokerUserId: { not: null },
            },
            _count: { _all: true },
          }),
        ]);

        const sortedContactTypes = [...contactTypeRows]
          .sort((a, b) => b._count._all - a._count._all)
          .slice(0, 8);

        const sortedTopOfficers = [...topOfficerRows]
          .filter((row) => row.brokerUserId)
          .sort((a, b) => b._count._all - a._count._all)
          .slice(0, 6);

        const officerIds = sortedTopOfficers.map((row) => row.brokerUserId);

        const officerAccounts = officerIds.length
          ? await prisma.userAccount.findMany({
              where: { id: { in: officerIds } },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
              },
            })
          : [];

        const officerNameById = new Map(
          officerAccounts.map((user) => [
            user.id,
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.email ||
              "Loan Officer",
          ]),
        );

        const network = {
          lenders: {
            connected: lendersConnected,
            inactive: lendersInactive,
            total: lendersConnected + lendersInactive,
          },
          officers: {
            total: officersTotal,
            active: officersActive,
            disabled: officersDisabled,
          },
          coBrokers: {
            total: coBrokersTotal,
            active: coBrokersActive,
            disabled: coBrokersDisabled,
          },
          borrowers: {
            total: borrowersTotal,
            portalReady: borrowersPortalReady,
            pendingLink: borrowersPendingLink,
            clients: clientsTotal,
          },
          contacts: {
            total: contactsTotal,
            byType: sortedContactTypes.map((row) => ({
              type: row.contactType,
              count: row._count._all,
            })),
          },
          topOfficers: sortedTopOfficers.map((row) => ({
            id: row.brokerUserId,
            name: officerNameById.get(row.brokerUserId) || "Loan Officer",
            applications: row._count._all,
          })),
        };

        return reply.send({
          success: true,
          data: {
            ...engine.finalize(),
            network,
          },
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
