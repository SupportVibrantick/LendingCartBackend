/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function rejectBrokerInviteRoutes(fastify) {
  fastify.post(
    "/reject/:inviteId",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "Reject broker connection invite",
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

      await prisma.brokerLenderInvite.update({
        where: { id: inviteId },
        data: { status: "REJECTED" },
      });

      return reply.send({
        success: true,
        message: "Invite rejected",
      });
    }
  );
}

module.exports = rejectBrokerInviteRoutes;
