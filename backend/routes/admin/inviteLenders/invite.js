// routes/admin/inviteLenders/invite.js

const { adminLogs } = require("../../../services/logger/contextLogger.js");

// Mail + Kafka
const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildLenderSignInUrl } = require("../../../utils/email/emailBranding");
const { buildLenderInviteEmailData } = require("../../../utils/email/emailTemplateData");
const sendMail = require("../../../services/emails/mail");

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
          "Admin can invite a lender by sending them a signup link via email.",
        body: {
          type: "object",
          required: ["fullName", "email", "phone"],
          properties: {
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
        const { fullName, email, phone } = request.body;

        // ---------------------------
        // BASIC VALIDATION
        // ---------------------------
        if (!fullName || !email || !phone) {
          return reply.status(400).send({
            success: false,
            message: "Full name, email, and phone are required.",
          });
        }

        // ---------------------------
        // CHECK IF USER ALREADY EXISTS
        // ---------------------------
        const existingUser = await prisma.userAccount.findFirst({
          where: { email },
        });

        if (existingUser) {
          return reply.status(409).send({
            success: false,
            message: "A user with this email already exists.",
            field: "email",
          });
        }

        // ---------------------------
        // PREPARE EMAIL
        // ---------------------------
        const html = loadTemplate(
          "admin/lender/invite",
          buildLenderInviteEmailData({
            name: fullName,
            email,
            phone,
            signupUrl: buildLenderSignInUrl(),
          }),
        );

        const subject = "You're Invited to Join as a Lender";
        const text = `Hello ${fullName}, you have been invited to join our lending platform. Please register using the provided link.`;

        // ---------------------------
        // SEND EMAIL
        // ---------------------------
        await sendMail({
          prisma,
          to: email,
          subject,
          text,
          html,
          idempotencyKey: `admin-lender-invite:${email}`,
        });

        adminLogs.info("Lender invitation email enqueued", {
          to: email,
          invitedName: fullName,
        });

        // ---------------------------
        // SUCCESS RESPONSE
        // ---------------------------
        return reply.status(200).send({
          success: true,
          message: "Lender invitation email sent successfully.",
          data: {
            invitedEmail: email,
          },
        });
      } catch (error) {
        adminLogs.error("Lender invitation failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error occurred while sending lender invitation.",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = inviteLenderRoutes;