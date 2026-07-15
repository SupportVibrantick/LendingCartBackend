const {
  expireStaleInvites,
  mapInviteForAdmin,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

function buildSearchWhere(search) {
  const q = String(search || "").trim();
  if (!q) return {};

  const phoneDigits = q.replace(/\D/g, "");
  return {
    OR: [
      { companyName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      ...(phoneDigits.length >= 3
        ? [{ phone: { contains: phoneDigits } }]
        : []),
    ],
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLenderInvitesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "List admin lender invitations",
        querystring: {
          type: "object",
          additionalProperties: true,
          properties: {
            page: { type: ["integer", "string"] },
            limit: { type: ["integer", "string"] },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "ACCEPTED",
                "DECLINED",
                "EXPIRED",
                "CANCELLED",
                "ALL",
                "",
              ],
            },
            search: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        await expireStaleInvites(prisma);

        const page = Math.max(1, parseInt(String(request.query?.page || "1"), 10) || 1);
        const limit = Math.min(
          100,
          Math.max(1, parseInt(String(request.query?.limit || "20"), 10) || 20),
        );
        const skip = (page - 1) * limit;
        const status = String(request.query?.status || "ALL").toUpperCase();
        const search = String(request.query?.search || "").trim();

        const searchWhere = buildSearchWhere(search);

        const where = {
          ...searchWhere,
        };
        if (status && status !== "ALL") {
          where.status = status;
        }

        // Stats follow search filter, but ignore status filter so cards stay meaningful
        const statsWhere = { ...searchWhere };

        const [invites, total, statusGroups, allTotal] = await Promise.all([
          prisma.adminLenderInvite.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.adminLenderInvite.count({ where }),
          prisma.adminLenderInvite.groupBy({
            by: ["status"],
            where: statsWhere,
            _count: { _all: true },
          }),
          prisma.adminLenderInvite.count({ where: statsWhere }),
        ]);

        const statusCounts = {
          pending: 0,
          accepted: 0,
          declined: 0,
          expired: 0,
          cancelled: 0,
        };

        for (const group of statusGroups) {
          const key = String(group.status || "").toLowerCase();
          if (key in statusCounts) {
            statusCounts[key] = group._count._all;
          }
        }

        const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

        return reply.send({
          success: true,
          data: invites.map(mapInviteForAdmin),
          meta: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            search: search || null,
            status: status || "ALL",
            all: allTotal,
            ...statusCounts,
          },
        });
      } catch (error) {
        request.log.error(error, "Failed to list lender invites");
        return reply.status(500).send({
          success: false,
          message: error.message || "Failed to list lender invitations",
        });
      }
    },
  );
}

module.exports = listLenderInvitesRoutes;
