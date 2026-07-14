const {
  findInviteByToken,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getPublicLenderInviteRoutes(fastify) {
  fastify.get(
    "/:token",
    {
      schema: {
        tags: ["Public -> Lender Invites"],
        summary: "Validate lender invitation token",
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
            code: "NOT_FOUND",
          });
        }

        if (invite.status === "EXPIRED") {
          return reply.status(410).send({
            success: false,
            message: "This invitation has expired",
            code: "EXPIRED",
            data: {
              status: invite.status,
              email: invite.email,
              companyName: invite.companyName,
            },
          });
        }

        if (invite.status === "ACCEPTED") {
          return reply.status(409).send({
            success: false,
            message: "This invitation has already been accepted",
            code: "ALREADY_ACCEPTED",
            data: { status: invite.status },
          });
        }

        if (invite.status === "DECLINED") {
          return reply.status(409).send({
            success: false,
            message: "This invitation was declined",
            code: "DECLINED",
            data: { status: invite.status },
          });
        }

        if (invite.status === "CANCELLED") {
          return reply.status(410).send({
            success: false,
            message: "This invitation was cancelled",
            code: "CANCELLED",
            data: { status: invite.status },
          });
        }

        return reply.send({
          success: true,
          data: {
            companyName: invite.companyName,
            fullName: invite.fullName,
            email: invite.email,
            phone: invite.phone,
            status: invite.status,
            expiresAt: invite.expiresAt,
          },
        });
      } catch (error) {
        request.log.error(error, "Failed to validate lender invite");
        return reply.status(500).send({
          success: false,
          message: "Failed to validate invitation",
        });
      }
    },
  );
}

module.exports = getPublicLenderInviteRoutes;
