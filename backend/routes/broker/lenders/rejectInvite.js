/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { requireLoConnectLenders } = require("../../../services/broker/loanOfficerAccess");

async function rejectInviteRoutes(fastify) {
  fastify.post(
    "/:inviteId",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Reject lender invite",
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

module.exports = rejectInviteRoutes;
