const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { sanitizeAuditValue } = require("../../../services/logger/sanitizeAuditValue");

function formatName(first, last) {
  return `${first || ""} ${last || ""}`.trim() || "Loan Officer";
}

async function getBrokerOrg(prisma, orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, type: true, name: true },
  });
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminBrokerLoanOfficerActivityRoutes(fastify) {
  fastify.get("/:orgId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId } = request.params;
    const q = request.query || {};
    const officerId = q.officerId?.trim();
    const page = Math.max(parseInt(q.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;
    const { fromDate, toDate } = q;

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      const officers = await prisma.userAccount.findMany({
        where: {
          organizationId: orgId,
          isDeleted: false,
          roles: { some: { role: { name: "BROKER_OFFICER" } } },
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
          data: { officers: [], activity: [] },
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
            brokerOrgId: orgId,
            brokerUserId: { in: officerIds },
          },
          _count: { _all: true },
        }),
        prisma.contact.groupBy({
          by: ["createdById"],
          where: {
            brokerOrgId: orgId,
            isDeleted: false,
            createdById: { in: officerIds },
          },
          _count: { _all: true },
        }),
        prisma.auditLog.groupBy({
          by: ["actorUserId"],
          where: {
            actorOrgId: orgId,
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
        actorOrgId: orgId,
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

      const activity = logs.map((log) => {
        let oldValue = null;
        let newValue = null;
        try {
          oldValue = log.oldValueJson
            ? sanitizeAuditValue(JSON.parse(log.oldValueJson))
            : null;
        } catch {
          oldValue = null;
        }
        try {
          newValue = log.newValueJson
            ? sanitizeAuditValue(JSON.parse(log.newValueJson))
            : null;
        } catch {
          newValue = null;
        }

        return {
          id: log.id,
          category: log.category,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: log.createdAt,
          ipAddress: log.ipAddress,
          oldValue,
          newValue,
          officer: log.actorUser
            ? {
                id: log.actorUser.id,
                email: log.actorUser.email,
                name: formatName(log.actorUser.firstName, log.actorUser.lastName),
              }
            : null,
        };
      });

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
      adminLogs.error("Admin broker loan officer activity failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to fetch loan officer activity",
      });
    }
  });
}

module.exports = adminBrokerLoanOfficerActivityRoutes;
