const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildLenderInviteUrl } = require("../../../utils/email/emailBranding");
const {
  buildLenderInviteEmailData,
} = require("../../../utils/email/emailTemplateData");
const sendMail = require("../../../services/emails/mail");
const {
  generateInviteToken,
  buildInviteExpiry,
  mapInviteForAdmin,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function resendLenderInviteRoutes(fastify) {
  fastify.post(
    "/:inviteId/resend",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Resend lender invitation",
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
            message: "Cannot resend an already accepted invitation",
          });
        }

        if (invite.status === "CANCELLED") {
          return reply.status(400).send({
            success: false,
            message: "Cannot resend a cancelled invitation. Create a new one.",
          });
        }

        const existingUser = await prisma.userAccount.findFirst({
          where: { email: invite.email, isDeleted: false },
        });

        if (existingUser) {
          return reply.status(409).send({
            success: false,
            message: "A user with this email already exists.",
          });
        }

        const token = generateInviteToken();
        const expiresAt = buildInviteExpiry();

        const updated = await prisma.adminLenderInvite.update({
          where: { id: invite.id },
          data: {
            token,
            status: "PENDING",
            expiresAt,
            lastSentAt: new Date(),
            declinedAt: null,
            cancelledAt: null,
          },
        });

        const signupUrl = buildLenderInviteUrl(token);

        const html = loadTemplate(
          "admin/lender/invite",
          buildLenderInviteEmailData({
            name: updated.fullName,
            email: updated.email,
            phone: updated.phone,
            companyName: updated.companyName,
            signupUrl,
          }),
        );

        await sendMail({
          prisma,
          to: updated.email,
          subject: "LendingCart has invited you to join as a Lender",
          text: `Hello ${updated.fullName}, LendingCart has invited you to join as a Lender. Accept your invitation: ${signupUrl}`,
          html,
          idempotencyKey: `admin-lender-invite:${updated.id}:${Date.now()}`,
        });

        adminLogs.info("Lender invitation resent", {
          inviteId: updated.id,
          to: updated.email,
        });

        return reply.send({
          success: true,
          message: "Invitation resent successfully",
          data: mapInviteForAdmin(updated),
        });
      } catch (error) {
        adminLogs.error("Failed to resend lender invitation", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to resend invitation",
        });
      }
    },
  );
}

module.exports = resendLenderInviteRoutes;
