// routes/admin/inviteLenders/invite.js

const { adminLogs } = require("../../../services/logger/contextLogger.js");

// Mail + Kafka
const { loadTemplate } = require("../../../utils/loadTemplate");
const sendMail = require("../../../services/mail");
const { sendEmailUsingKafka } = require("../../../services/kafka/email/producer.js");

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
        const apiBase = process.env.VITE_API_BASE || process.env.APP_URL;

        const signupUrl = `${apiBase}/lender/register`;

        const html = loadTemplate("admin/lender/invite", {
          name: fullName,
          email,
          phone,
          signupUrl,
          currentYear: new Date().getFullYear(),
        });

        const subject = "You're Invited to Join as a Lender";
        const text = `Hello ${fullName}, you have been invited to join our lending platform. Please register using the provided link.`;

        // ---------------------------
        // SEND EMAIL
        // ---------------------------
        try {
          await sendEmailUsingKafka(email, subject, text, html);

          adminLogs.info("Lender invitation email queued via Kafka", {
            to: email,
            invitedName: fullName,
          });
        } catch (kafkaErr) {
          adminLogs.error("Kafka email failed, falling back to SMTP", kafkaErr);

          await sendMail({
            to: email,
            subject,
            text,
            html,
          });

          adminLogs.info("SMTP fallback email sent for lender invite", {
            to: email,
          });
        }

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