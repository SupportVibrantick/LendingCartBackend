const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  createAdminLenderInviteAndEnqueue,
} = require("../../../services/lenderInvites/createAdminLenderInvite");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function inviteLenderRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Send lender invitation email",
        description:
          "Admin invites a lender by creating a tokenized invite and emailing the signup link.",
        body: {
          type: "object",
          required: ["fullName", "email", "phone", "companyName"],
          properties: {
            companyName: { type: "string" },
            fullName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const invite = await createAdminLenderInviteAndEnqueue(prisma, {
          companyName: request.body.companyName,
          fullName: request.body.fullName,
          email: request.body.email,
          phone: request.body.phone,
          invitedByAdminId: request.user?.id || null,
        });

        adminLogs.info("Lender invitation created and email enqueued", {
          inviteId: invite.id,
          to: invite.email,
          invitedName: invite.fullName,
        });

        return reply.status(200).send({
          success: true,
          message: "Lender invitation email sent successfully.",
          data: invite,
        });
      } catch (error) {
        if (error.code === "VALIDATION") {
          return reply.status(400).send({
            success: false,
            message: error.message,
          });
        }
        if (error.code === "CONFLICT") {
          return reply.status(409).send({
            success: false,
            message: error.message,
            field: "email",
          });
        }

        adminLogs.error("Lender invitation failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error occurred while sending lender invitation.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    },
  );
}

module.exports = inviteLenderRoutes;
