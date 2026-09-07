/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function loanOfficerActivityRoute(fastify) {
  const formatName = (first, last) =>
    `${first || ""} ${last || ""}`.trim() || "Loan Officer";

  /**
   * Build officer summary cards (apps / contacts / last activity) for a set of users.
   * @param {import("@prisma/client").PrismaClient} prisma
   * @param {string} brokerOrgId
   * @param {Array<{id: string, email: string, firstName: string|null, lastName: string|null, status: string, lastLoginAt: Date|null}>} officers
   */
  async function buildOfficerSummaries(prisma, brokerOrgId, officers) {
    const officerIds = officers.map((o) => o.id);
    if (!officerIds.length) return [];

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

    return officers.map((o) => ({
      id: o.id,
      name: formatName(o.firstName, o.lastName),
      email: o.email,
      status: o.status,
      lastLoginAt: o.lastLoginAt,
      assignedApplications: appCountMap.get(o.id) || 0,
      contactsCreated: contactCountMap.get(o.id) || 0,
      lastActivityAt: lastActivityMap.get(o.id) || null,
    }));
  }

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
            search: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            officerPage: { type: "integer", minimum: 1, default: 1 },
            officerLimit: {
              type: "integer",
              minimum: 1,
              maximum: 50,
              default: 15,
            },
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
        const {
          officerId,
          search = "",
          page = 1,
          limit = 20,
          officerPage = 1,
          officerLimit = 15,
          fromDate,
          toDate,
        } = req.query;

        const officerBaseWhere = {
          organizationId: brokerOrgId,
          isDeleted: false,
          roles: {
            some: { role: { name: "BROKER_OFFICER" } },
          },
        };

        const searchTerm = String(search || "").trim();
        const officerWhere = {
          ...officerBaseWhere,
          ...(searchTerm
            ? {
                OR: [
                  { firstName: { contains: searchTerm, mode: "insensitive" } },
                  { lastName: { contains: searchTerm, mode: "insensitive" } },
                  { email: { contains: searchTerm, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const officerSkip = (officerPage - 1) * officerLimit;

        const [officerRows, officerTotal] = await prisma.$transaction([
          prisma.userAccount.findMany({
            where: officerWhere,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              lastLoginAt: true,
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
            skip: officerSkip,
            take: officerLimit,
          }),
          prisma.userAccount.count({ where: officerWhere }),
        ]);

        const officers = await buildOfficerSummaries(
          prisma,
          brokerOrgId,
          officerRows,
        );

        /** @type {null | Awaited<ReturnType<typeof buildOfficerSummaries>>[number]} */
        let selectedOfficer = null;
        let activityOfficerId = null;

        if (officerId) {
          const selectedRow = await prisma.userAccount.findFirst({
            where: {
              ...officerBaseWhere,
              id: officerId,
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              lastLoginAt: true,
            },
          });

          if (selectedRow) {
            activityOfficerId = selectedRow.id;
            const fromPage = officers.find((o) => o.id === selectedRow.id);
            selectedOfficer =
              fromPage ||
              (
                await buildOfficerSummaries(prisma, brokerOrgId, [selectedRow])
              )[0];
          }
        }

        const activitySkip = (page - 1) * limit;
        let activity = [];
        let total = 0;
        let totalPages = 0;

        if (activityOfficerId) {
          const activityWhere = {
            actorOrgId: brokerOrgId,
            dashboard: "BROKER",
            actorUserId: activityOfficerId,
          };

          if (fromDate || toDate) {
            activityWhere.createdAt = {};
            if (fromDate) activityWhere.createdAt.gte = new Date(fromDate);
            if (toDate) activityWhere.createdAt.lte = new Date(toDate);
          }

          const [logs, activityTotal] = await prisma.$transaction([
            prisma.auditLog.findMany({
              where: activityWhere,
              skip: activitySkip,
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

          total = activityTotal;
          totalPages = Math.ceil(total / limit) || 0;
          activity = logs.map((log) => ({
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
        }

        return reply.send({
          success: true,
          data: {
            officers,
            selectedOfficer,
            activity,
            officersMeta: {
              page: officerPage,
              limit: officerLimit,
              total: officerTotal,
              totalPages: Math.ceil(officerTotal / officerLimit) || 0,
              search: searchTerm,
            },
          },
          page,
          limit,
          total,
          totalPages,
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
