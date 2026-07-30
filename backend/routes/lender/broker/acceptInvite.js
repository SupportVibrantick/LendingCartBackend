/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function acceptBrokerInviteRoutes(fastify) {
  fastify.post(
    "/accept/:inviteId",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "Accept broker connection invite",
        params: {
          type: "object",
          required: ["inviteId"],
          properties: {
            inviteId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { inviteId } = req.params;

      if (!req.user || req.user.orgType !== "LENDER" || !req.user.organizationId) {
        return reply.code(403).send({
          success: false,
          message: "Lender access only",
        });
      }

      const lenderOrgId = req.user.organizationId;

      const invite = await prisma.brokerLenderInvite.findFirst({
        where: {
          id: inviteId,
          lenderOrgId,
          status: "PENDING",
          initiatedBy: "BROKER",
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
          brokerOrgId: invite.brokerOrgId,
          lenderOrgId,
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
              brokerOrgId: invite.brokerOrgId,
              lenderOrgId,
              source: "BROKER_ADDED",
            },
          });
        }
      });

      return reply.send({
        success: true,
        message: "Broker connected successfully",
      });
    }
  );
}

module.exports = acceptBrokerInviteRoutes;
