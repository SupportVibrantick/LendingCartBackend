/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function loanOfficerActivityRoute(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Loan Officer Activity"],
        summary: "List loan officer activity for broker admin",
        querystring: {
          type: "object",
          properties: {
            officerId: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            fromDate: { type: "string", format: "date-time" },
            toDate: { type: "string", format: "date-time" },
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

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can view loan officer activity",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { officerId, page = 1, limit = 20, fromDate, toDate } = req.query;
        const skip = (page - 1) * limit;

        const officers = await prisma.userAccount.findMany({
          where: {
            organizationId: brokerOrgId,
            isDeleted: false,
            roles: {
              some: { role: { name: "BROKER_OFFICER" } },
            },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastLoginAt: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });

        const officerIds = officers.map((o) => o.id);
        const scopedOfficerIds =
          officerId && officerIds.includes(officerId)
            ? [officerId]
            : officerId
              ? []
              : officerIds;

        if (officerId && scopedOfficerIds.length === 0) {
          return reply.send({
            success: true,
            data: {
              officers: [],
              activity: [],
            },
            page,
            limit,
            total: 0,
            totalPages: 0,
          });
        }

        const [applicationCounts, contactCounts, lastLogRows] = await Promise.all([
          prisma.loanApplication.groupBy({
            by: ["brokerUserId"],
            where: {
              brokerOrgId,
              brokerUserId: { in: officerIds },
            },
            _count: { _all: true },
          }),
          prisma.contact.groupBy({
            by: ["createdById"],
            where: {
              brokerOrgId,
              isDeleted: false,
              createdById: { in: officerIds },
            },
            _count: { _all: true },
          }),
          prisma.auditLog.groupBy({
            by: ["actorUserId"],
            where: {
              actorOrgId: brokerOrgId,
              dashboard: "BROKER",
              actorUserId: { in: officerIds },
            },
            _max: { createdAt: true },
          }),
        ]);

        const appCountMap = new Map(
          applicationCounts.map((row) => [row.brokerUserId, row._count._all]),
        );
        const contactCountMap = new Map(
          contactCounts.map((row) => [row.createdById, row._count._all]),
        );
        const lastActivityMap = new Map(
          lastLogRows.map((row) => [row.actorUserId, row._max.createdAt]),
        );

        const formatName = (first, last) =>
          `${first || ""} ${last || ""}`.trim() || "Loan Officer";

        const officerSummaries = officers.map((o) => ({
          id: o.id,
          name: formatName(o.firstName, o.lastName),
          email: o.email,
          status: o.status,
          lastLoginAt: o.lastLoginAt,
          assignedApplications: appCountMap.get(o.id) || 0,
          contactsCreated: contactCountMap.get(o.id) || 0,
          lastActivityAt: lastActivityMap.get(o.id) || null,
        }));

        const activityWhere = {
          actorOrgId: brokerOrgId,
          dashboard: "BROKER",
          actorUserId: { in: scopedOfficerIds },
        };

        if (fromDate || toDate) {
          activityWhere.createdAt = {};
          if (fromDate) activityWhere.createdAt.gte = new Date(fromDate);
          if (toDate) activityWhere.createdAt.lte = new Date(toDate);
        }

        const [logs, total] = await prisma.$transaction([
          prisma.auditLog.findMany({
            where: activityWhere,
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
                },
              },
            },
          }),
          prisma.auditLog.count({ where: activityWhere }),
        ]);

        const activity = logs.map((log) => ({
          id: log.id,
          category: log.category,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: log.createdAt,
          ipAddress: log.ipAddress,
          oldValue: log.oldValueJson ? JSON.parse(log.oldValueJson) : null,
          newValue: log.newValueJson ? JSON.parse(log.newValueJson) : null,
          officer: log.actorUser
            ? {
                id: log.actorUser.id,
                email: log.actorUser.email,
                name: formatName(
                  log.actorUser.firstName,
                  log.actorUser.lastName,
                ),
              }
            : null,
        }));

        return reply.send({
          success: true,
          data: {
            officers: officerSummaries,
            activity,
          },
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Loan officer activity fetch failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
