const {
  expireStaleInvites,
  mapInviteForAdmin,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

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
          properties: {
            status: {
              type: "string",
              enum: [
                "PENDING",
                "ACCEPTED",
                "DECLINED",
                "EXPIRED",
                "CANCELLED",
                "ALL",
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

        const status = String(request.query?.status || "ALL").toUpperCase();
        const search = String(request.query?.search || "").trim();

        const where = {};
        if (status && status !== "ALL") {
          where.status = status;
        }
        if (search) {
          where.OR = [
            { companyName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
          ];
        }

        const invites = await prisma.adminLenderInvite.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          success: true,
          data: invites.map(mapInviteForAdmin),
          meta: {
            total: invites.length,
            pending: invites.filter((i) => i.status === "PENDING").length,
            accepted: invites.filter((i) => i.status === "ACCEPTED").length,
            declined: invites.filter((i) => i.status === "DECLINED").length,
            expired: invites.filter((i) => i.status === "EXPIRED").length,
            cancelled: invites.filter((i) => i.status === "CANCELLED").length,
          },
        });
      } catch (error) {
        request.log.error(error, "Failed to list lender invites");
        return reply.status(500).send({
          success: false,
          message: "Failed to list lender invitations",
        });
      }
    },
  );
}

module.exports = listLenderInvitesRoutes;
