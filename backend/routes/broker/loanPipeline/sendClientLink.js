const crypto = require("crypto");

const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildClientLinkEmailData } = require("../../../utils/email/emailTemplateData");
const sendMail = require("../../../services/emails/mail");
const { buildClientPortalUrl } = require("../../../utils/email/emailBranding");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function sendClientLinkRoute(fastify) {
  fastify.post(
    "/:loanId/send-client-link",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Send client portal access link",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK
        =============================== */
        if (
          !req.user ||
          req.user.orgType !== "BROKER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { loanId } = req.params;

        /* ===============================
           FETCH LOAN + CLIENT
        =============================== */
        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanId,
            brokerOrgId,
          },
          include: {
            client: {
              include: {
                contacts: true,
              },
            },
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        if (loan.status !== "DRAFT") {
          return reply.code(400).send({
            success: false,
            message: "Client link can only be sent for draft applications",
          });
        }

        /* ===============================
           GET CLIENT EMAIL (SAFE)
        =============================== */
        const primaryContact = loan.client.contacts.find(
          (c) => c.isPrimary && c.email
        );

        const fallbackContact = loan.client.contacts.find((c) => c.email);

        const clientEmail = primaryContact?.email || fallbackContact?.email;

        if (!clientEmail) {
          return reply.code(400).send({
            success: false,
            message: "Client email not available",
          });
        }

        /* ===============================
           GENERATE / REPLACE TOKEN (CORE FIX)
        =============================== */
        let tokenRecord;

        await prisma.$transaction(async (tx) => {
          const token = crypto.randomBytes(32).toString("hex");

          const expiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          );

          try {
            // 🔥 UPSERT → ensures ONE token per loan
            tokenRecord = await tx.clientUploadToken.upsert({
              where: {
                loanApplicationId: loan.id,
              },
              update: {
                token,
                expiresAt,
                isUsed: false,
              },
              create: {
                loanApplicationId: loan.id,
                clientId: loan.clientId,
                token,
                expiresAt,
              },
            });
          } catch (err) {
            // 🔒 fallback for rare race condition
            if (err.code === "P2002") {
              tokenRecord = await tx.clientUploadToken.update({
                where: { loanApplicationId: loan.id },
                data: {
                  token,
                  expiresAt,
                  isUsed: false,
                },
              });
            } else {
              throw err;
            }
          }

          // OPTIONAL: update loan status
          if (loan.status === "DRAFT") {
            await tx.loanApplication.update({
              where: { id: loan.id },
              data: { status: "CLIENT_PENDING" },
            });
          }
        });

        if (!tokenRecord?.token) {
          throw new Error("Token generation failed");
        }

        /* ===============================
           PREPARE LINK
        =============================== */
        if (!process.env.FRONTEND_URL) {
          throw new Error("FRONTEND_URL not configured");
        }

        const uploadLink = buildClientPortalUrl({
          path: `/client-portal/${tokenRecord.token}`,
        });

        /* ===============================
           EMAIL TEMPLATE
        =============================== */
        const html = loadTemplate(
          "broker/clientLink",
          buildClientLinkEmailData({
            clientName: loan.client?.legalName,
            uploadLink,
            applicationNumber: loan.applicationNumber,
            brokerName: req.user?.firstName,
            preset: "portalAccess",
          }),
        );

        const subject = "Access Your Loan Application Portal";

        const text = `Access your loan application using this secure link:\n${uploadLink}`;

        /* ===============================
           SEND EMAIL
        =============================== */
        try {
          await sendMail({
            to: clientEmail,
            subject,
            text,
            html,
          });

          fastify.log.info(
            { clientEmail, loanId },
            "Email sent successfully"
          );
        } catch (err) {
          fastify.log.error(
            { error: err.message, clientEmail, loanId },
            "Email sending failed"
          );

          return reply.code(500).send({
            success: false,
            message: "Failed to send email. Check SMTP configuration.",
          });
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "Client portal link sent successfully",
          data: {
            email: clientEmail,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            loanId: req.params.loanId,
            brokerOrgId: req.user?.organizationId,
          },
          "Failed to send client portal link"
        );

        return reply.code(500).send({
          success: false,
          message: error.message || "Unexpected server error",
        });
      }
    }
  );
}

module.exports = sendClientLinkRoute;