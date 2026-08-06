/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { requireLoConnectLenders } = require("../../../services/broker/loanOfficerAccess");

async function acceptInviteRoutes(fastify) {
  fastify.post(
    "/:inviteId",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Accept lender invite",
        params: {
          type: "object",
          properties: {
            inviteId: { type: "string", format: "uuid" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoConnectLenders(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { inviteId } = req.params;

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;

      const invite = await prisma.brokerLenderInvite.findFirst({
        where: {
          id: inviteId,
          brokerOrgId,
          status: "PENDING",
          initiatedBy: "LENDER",
        },
      });

      if (!invite) {
        return reply.code(404).send({
          success: false,
          message: "Invite not found",
        });
      }

      const existingAccess = await prisma.brokerLenderAccess.findFirst({
        where: {
          brokerOrgId,
          lenderOrgId: invite.lenderOrgId,
        },
      });

      await prisma.$transaction(async (tx) => {
        await tx.brokerLenderInvite.update({
          where: { id: inviteId },
          data: { status: "ACCEPTED" },
        });

        if (existingAccess) {
          await tx.brokerLenderAccess.update({
            where: { id: existingAccess.id },
            data: { isActive: true },
          });
        } else {
          await tx.brokerLenderAccess.create({
            data: {
              brokerOrgId,
              lenderOrgId: invite.lenderOrgId,
              source: "BROKER_ADDED",
            },
          });
        }
      });

      return reply.send({
        success: true,
        message: "Lender connected successfully",
      });
    }
  );
}

module.exports = acceptInviteRoutes;
