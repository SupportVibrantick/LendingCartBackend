const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deleteLenderInviteRoutes(fastify) {
  fastify.delete(
    "/:inviteId",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Delete lender invitation",
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
            message: "Cannot delete an accepted invitation",
          });
        }

        await prisma.adminLenderInvite.delete({
          where: { id: invite.id },
        });

        adminLogs.info("Lender invitation deleted", {
          inviteId: invite.id,
          email: invite.email,
        });

        return reply.send({
          success: true,
          message: "Invitation deleted",
        });
      } catch (error) {
        adminLogs.error("Failed to delete lender invitation", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to delete invitation",
        });
      }
    },
  );
}

module.exports = deleteLenderInviteRoutes;
