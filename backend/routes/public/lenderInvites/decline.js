const {
  findInviteByToken,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function declinePublicLenderInviteRoutes(fastify) {
  fastify.post(
    "/:token/decline",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
      schema: {
        tags: ["Public -> Lender Invites"],
        summary: "Decline lender invitation",
        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { token } = request.params;

      try {
        const invite = await findInviteByToken(prisma, token);

        if (!invite) {
          return reply.status(404).send({
            success: false,
            message: "Invitation not found or invalid",
          });
        }

        if (invite.status !== "PENDING") {
          return reply.status(400).send({
            success: false,
            message: `Invitation cannot be declined (status: ${invite.status})`,
            data: { status: invite.status },
          });
        }

        const updated = await prisma.adminLenderInvite.update({
          where: { id: invite.id },
          data: {
            status: "DECLINED",
            declinedAt: new Date(),
          },
        });

        return reply.send({
          success: true,
          message: "Invitation declined",
          data: {
            status: updated.status,
            email: updated.email,
          },
        });
      } catch (error) {
        request.log.error(error, "Failed to decline lender invite");
        return reply.status(500).send({
          success: false,
          message: "Failed to decline invitation",
        });
      }
    },
  );
}

module.exports = declinePublicLenderInviteRoutes;
