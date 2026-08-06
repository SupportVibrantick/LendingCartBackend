/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { requireLoMarketplaceView } = require("../../../services/broker/loanOfficerAccess");

async function brokerInvitesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Get lender invites",
        description: "List pending lender invites",
      },
      preHandler: async (req, reply) => {
        await requireLoMarketplaceView(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;

      const invites = await prisma.brokerLenderInvite.findMany({
        where: {
          brokerOrgId,
          status: "PENDING",
          initiatedBy: "LENDER",
        },
        include: {
          lender: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        data: invites.map((i) => ({
          inviteId: i.id,
          lenderId: i.lender.id,
          lenderName: i.lender.name,
          lenderEmail: i.lender.email,
          invitedAt: i.createdAt,
        })),
      });
    }
  );
}

module.exports = brokerInvitesRoutes;
