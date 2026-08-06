const {
  mapSubmission,
  resendBrokerLenderInvite,
} = require("../../../../services/lenderInvites/brokerLenderSubmission");
const {
  requireLoMarketplaceView,
  requireLoAddOwnLender,
} = require("../../../../services/broker/loanOfficerAccess");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function communitySubmissionsRoutes(fastify) {
  fastify.get(
    "/submissions",
    {
      schema: {
        tags: ["Broker -> Lenders -> Community"],
        summary: "List lenders submitted by this broker",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            search: { type: "string" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoMarketplaceView(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const brokerOrgId = req.user?.organizationId;

      if (!brokerOrgId) {
        return reply.code(403).send({ success: false, message: "Unauthorized" });
      }

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const search = (req.query.search || "").trim();
      const skip = (page - 1) * limit;

      const where = {
        invitedByBrokerOrgId: brokerOrgId,
        inviteSource: "BROKER",
        ...(search
          ? {
              OR: [
                { companyName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [invites, total] = await prisma.$transaction([
        prisma.adminLenderInvite.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            lenderOrg: {
              select: {
                id: true,
                name: true,
                status: true,
                email: true,
                phone: true,
                lenderProfile: {
                  select: {
                    profileStatus: true,
                    isVisible: true,
                    website: true,
                  },
                },
              },
            },
          },
        }),
        prisma.adminLenderInvite.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: invites.map((invite) => mapSubmission(invite, invite.lenderOrg)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    },
  );

  fastify.get(
    "/submissions/:inviteId/status",
    {
      schema: {
        tags: ["Broker -> Lenders -> Community"],
        summary: "View submission / invite status",
        params: {
          type: "object",
          required: ["inviteId"],
          properties: {
            inviteId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoMarketplaceView(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const brokerOrgId = req.user?.organizationId;
      const { inviteId } = req.params;

      if (!brokerOrgId) {
        return reply.code(403).send({ success: false, message: "Unauthorized" });
      }

      const invite = await prisma.adminLenderInvite.findFirst({
        where: {
          id: inviteId,
          invitedByBrokerOrgId: brokerOrgId,
          inviteSource: "BROKER",
        },
        include: {
          lenderOrg: {
            select: {
              id: true,
              name: true,
              status: true,
              email: true,
              phone: true,
              lenderProfile: {
                select: {
                  profileStatus: true,
                  isVisible: true,
                  website: true,
                },
              },
            },
          },
        },
      });

      if (!invite) {
        return reply.code(404).send({
          success: false,
          message: "Submission not found",
        });
      }

      return reply.send({
        success: true,
        data: mapSubmission(invite, invite.lenderOrg),
      });
    },
  );

  fastify.post(
    "/submissions/:inviteId/resend",
    {
      schema: {
        tags: ["Broker -> Lenders -> Community"],
        summary: "Resend lender invitation email (new token, 7-day expiry)",
        params: {
          type: "object",
          required: ["inviteId"],
          properties: {
            inviteId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoAddOwnLender(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const brokerOrgId = req.user?.organizationId;
      const { inviteId } = req.params;

      if (!brokerOrgId) {
        return reply.code(403).send({ success: false, message: "Unauthorized" });
      }

      try {
        const data = await resendBrokerLenderInvite(
          prisma,
          inviteId,
          brokerOrgId,
        );

        return reply.send({
          success: true,
          message: "Invitation resent successfully",
          data,
        });
      } catch (err) {
        if (err.code === "NOT_FOUND") {
          return reply.code(404).send({ success: false, message: err.message });
        }
        if (err.code === "ALREADY_ACCEPTED") {
          return reply.code(409).send({ success: false, message: err.message });
        }
        req.log.error(err);
        return reply.code(500).send({
          success: false,
          message: err.message || "Failed to resend invitation",
        });
      }
    },
  );
}

module.exports = communitySubmissionsRoutes;
