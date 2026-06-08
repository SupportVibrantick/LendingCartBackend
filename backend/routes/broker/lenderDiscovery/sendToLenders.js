const sendMail = require("../../../services/mail");
const generateApplicationPDF = require("../../../services/generateApplicationPdf");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/brokerNotifications");

module.exports = async function sendToLenders(fastify) {
  fastify.post(
    "/applications/:applicationId/submissions/:submissionId/send-to-lenders",
    {
      schema: {
        tags: ["Broker -> Lender Discovery"],
        summary: "Send submission to selected lenders",
        body: {
          type: "object",
          required: ["lenderProductIds"],
          properties: {
            lenderProductIds: {
              type: "array",
              minItems: 1,
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      let { applicationId, submissionId } = req.params;
      const { lenderProductIds } = req.body;

      applicationId = applicationId.replace(/"/g, "").trim();
      submissionId = submissionId.replace(/"/g, "").trim();

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      /* =====================================================
         🔥 FIX: UNIVERSAL USER ID (CRITICAL)
      ===================================================== */
      const userId =
        req.user?.id ||
        req.user?.userId ||
        req.user?.clientId;

      if (!userId) {
        fastify.log.error("❌ USER ID MISSING", req.user);
        return reply.code(401).send({
          success: false,
          message: "Invalid user token",
        });
      }

      const brokerOrgId = req.user.organizationId;

      try {
        /* ================= VALIDATIONS ================= */

        const application = await prisma.loanApplication.findUnique({
          where: { id: applicationId },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        if (application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "You do not own this application",
          });
        }

        const roles = req.user.roles || [];
        if (roles.includes("BROKER_OFFICER")) {
          const userId = req.user.id || req.user.userId;
          if (application.brokerUserId !== userId) {
            return reply.code(403).send({
              success: false,
              message: "Access denied - not assigned to you",
            });
          }
        }

        const submission = await prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { fields: true },
        });

        if (!submission || submission.applicationId !== applicationId) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        const lenderProducts = await prisma.lenderProduct.findMany({
          where: {
            id: { in: lenderProductIds },
            isActive: true,
            loanProductCode: application.loanProductCode,
          },
          include: { lender: true },
        });

        if (lenderProducts.length !== lenderProductIds.length) {
          return reply.code(400).send({
            success: false,
            message: "Invalid lender products",
          });
        }

        /* ================= TRANSACTION ================= */

        const results = await prisma.$transaction(async (tx) => {
          const created = [];

          for (const lp of lenderProducts) {
            const existing = await tx.applicationLender.findFirst({
              where: {
                loanApplicationId: applicationId,
                lenderProductId: lp.id,
              },
            });

            if (existing) continue;

            const appLender = await tx.applicationLender.create({
              data: {
                loanApplicationId: applicationId,
                lenderOrgId: lp.lenderOrgId,
                lenderProductId: lp.id,
                sentByUserId: userId,
                sentAt: new Date(),
                status: "SENT",
              },
            });

            /* ================= CREATE CONVERSATION ================= */

            const conversation = await tx.conversation.create({
              data: {
                loanApplicationId: applicationId,
                applicationLenderId: appLender.id,
                type: "BROKER_LENDER",
              },
            });

            /* ================= PARTICIPANTS ================= */

            const lenderUsers = await tx.userAccount.findMany({
              where: { organizationId: lp.lenderOrgId },
              select: { id: true },
            });

            if (!userId) {
              throw new Error("❌ Broker ID missing while creating participants");
            }

            const participants = [
              {
                conversationId: conversation.id,
                participantType: "BROKER",
                participantId: userId, // ✅ FIXED
              },
              ...lenderUsers.map((u) => ({
                conversationId: conversation.id,
                participantType: "LENDER",
                participantId: u.id,
              })),
            ];

            await tx.conversationParticipant.createMany({
              data: participants,
              skipDuplicates: true,
            });

            fastify.log.info({
              msg: "✅ Conversation created",
              conversationId: conversation.id,
              brokerId: userId,
              lenderCount: lenderUsers.length,
            });

            created.push({
              lenderEmail: lp.lender.email,
              lenderName: lp.lender.name,
              applicationLenderId: appLender.id,
              lenderOrgId: lp.lenderOrgId,
            });
          }

          return created;
        });

        /* ================= EMAIL (NON BLOCKING) ================= */

        (async () => {
          for (const r of results) {
            if (!r.lenderEmail) continue;

            try {
              const pdfBuffer = await generateApplicationPDF(
                application,
                submission
              );

              await sendMail({
                to: r.lenderEmail,
                subject: "New Loan Application",
                text: "A new loan application has been submitted.",
                attachments: [
                  {
                    filename: `Loan-${application.id}.pdf`,
                    content: pdfBuffer.toString("base64"),
                    encoding: "base64",
                  },
                ],
              });

              fastify.log.info(`📧 Email sent: ${r.lenderEmail}`);
            } catch (err) {
              fastify.log.error(
                { err: err.message, email: r.lenderEmail },
                "Email failed"
              );
            }
          }
        })();

        if (results.length > 0) {
          const lenderNames = results
            .map((item) => item.lenderName)
            .filter(Boolean);

          await notifyBroker(prisma, fastify.io, {
            brokerOrgId,
            eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_SENT_TO_LENDERS,
            category: "LENDER",
            subject: "Application Sent to Lenders",
            body: `Application ${application.applicationNumber} sent to ${results.length} lender${results.length > 1 ? "s" : ""}`,
            metadata: {
              applicationId,
              applicationNumber: application.applicationNumber,
              lenderCount: results.length,
              lenderNames,
              applicationLenderIds: results.map((item) => item.applicationLenderId),
            },
          });
        }

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          message: "Sent to lenders successfully",
          data: results,
        });

      } catch (error) {
        fastify.log.error(
          { error: error.message, applicationId, submissionId },
          "Send to lenders failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};