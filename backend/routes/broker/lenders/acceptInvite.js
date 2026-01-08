/**
 * @param {import("fastify").FastifyInstance} fastify
 */
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
        },
      });

      if (!invite) {
        return reply.code(404).send({
          success: false,
          message: "Invite not found",
        });
      }

      await prisma.$transaction([
        prisma.brokerLenderInvite.update({
          where: { id: inviteId },
          data: { status: "ACCEPTED" },
        }),
        prisma.brokerLenderAccess.create({
          data: {
            brokerOrgId,
            lenderOrgId: invite.lenderOrgId,
            source: "BROKER_ADDED",
          },
        }),
      ]);

      return reply.send({
        success: true,
        message: "Lender connected successfully",
      });
    }
  );
}

module.exports = acceptInviteRoutes;
