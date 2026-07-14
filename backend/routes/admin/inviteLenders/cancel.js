const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  mapInviteForAdmin,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function cancelLenderInviteRoutes(fastify) {
  fastify.post(
    "/:inviteId/cancel",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Cancel lender invitation",
        params: {
          type: "object",
          required: ["inviteId"],
          properties: {
            inviteId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { inviteId } = request.params;

      try {
        const invite = await prisma.adminLenderInvite.findUnique({
          where: { id: inviteId },
        });

        if (!invite) {
          return reply.status(404).send({
            success: false,
            message: "Invitation not found",
          });
        }

        if (invite.status === "ACCEPTED") {
          return reply.status(400).send({
            success: false,
            message: "Cannot cancel an accepted invitation",
          });
        }

        if (invite.status === "CANCELLED") {
          return reply.send({
            success: true,
            message: "Invitation already cancelled",
            data: mapInviteForAdmin(invite),
          });
        }

        const updated = await prisma.adminLenderInvite.update({
          where: { id: invite.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
          },
        });

        adminLogs.info("Lender invitation cancelled", {
          inviteId: updated.id,
          email: updated.email,
        });

        return reply.send({
          success: true,
          message: "Invitation cancelled",
          data: mapInviteForAdmin(updated),
        });
      } catch (error) {
        adminLogs.error("Failed to cancel lender invitation", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to cancel invitation",
        });
      }
    },
  );
}

module.exports = cancelLenderInviteRoutes;
