/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { requireLoMarketplaceView } = require("../../../services/broker/loanOfficerAccess");

async function connectedLendersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Get connected lenders",
        description: "List lenders connected with broker",
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

      const lenders = await prisma.brokerLenderAccess.findMany({
        where: {
          brokerOrgId,
          isActive: true,
        },
        include: {
          lender: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        data: lenders.map((l) => ({
          lenderId: l.lender.id,
          lenderName: l.lender.name,
          lenderEmail: l.lender.email,
          connectedAt: l.createdAt,
        })),
      });
    }
  );
}

module.exports = connectedLendersRoutes;
