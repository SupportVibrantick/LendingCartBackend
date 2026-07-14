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
        const companyName = String(request.body.companyName || "").trim();
        const fullName = String(request.body.fullName || "").trim();
        const email = String(request.body.email || "").trim().toLowerCase();
        const phone = String(request.body.phone || "").trim();

        if (!companyName || !fullName || !email || !phone) {
          return reply.status(400).send({
            success: false,
            message: "Company name, full name, email, and phone are required.",
          });
        }

        const existingUser = await prisma.userAccount.findFirst({
          where: { email, isDeleted: false },
        });

        if (existingUser) {
          return reply.status(409).send({
            success: false,
            message: "A user with this email already exists.",
            field: "email",
          });
        }

        const pendingInvite = await prisma.adminLenderInvite.findFirst({
          where: {
            email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        });

        if (pendingInvite) {
          return reply.status(409).send({
            success: false,
            message:
              "A pending invitation already exists for this email. Resend or cancel it first.",
            field: "email",
            data: { inviteId: pendingInvite.id },
          });
        }

        const token = generateInviteToken();
        const expiresAt = buildInviteExpiry();
        const invitedByAdminId = request.user?.id || null;

        const invite = await prisma.adminLenderInvite.create({
          data: {
            companyName,
            fullName,
            email,
            phone,
            token,
            status: "PENDING",
            expiresAt,
            lastSentAt: new Date(),
            invitedByAdminId,
          },
        });

        const signupUrl = buildLenderInviteUrl(token);

        const html = loadTemplate(
          "admin/lender/invite",
          buildLenderInviteEmailData({
            name: fullName,
            email,
            phone,
            companyName,
            signupUrl,
          }),
        );

        const subject = "LendingCart has invited you to join as a Lender";
        const text = `Hello ${fullName}, LendingCart has invited you to join as a Lender. Accept your invitation: ${signupUrl}`;

        await sendMail({
          prisma,
          to: email,
          subject,
          text,
          html,
          idempotencyKey: `admin-lender-invite:${invite.id}:${Date.now()}`,
        });

        adminLogs.info("Lender invitation created and email enqueued", {
          inviteId: invite.id,
          to: email,
          invitedName: fullName,
        });

        return reply.status(200).send({
          success: true,
          message: "Lender invitation email sent successfully.",
          data: mapInviteForAdmin(invite),
        });
      } catch (error) {
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
