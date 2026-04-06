const sendMail = require("../../../services/mail");
const generateApplicationPDF = require("../../../services/generateApplicationPdf");

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

      // ================= SAFE CLEANUP =================
      applicationId = applicationId.replace(/"/g, "").trim();
      submissionId = submissionId.replace(/"/g, "").trim();

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const userId = req.user.id;
      const brokerOrgId = req.user.organizationId;

      // ================= CONSTANTS (PRODUCTION SAFE) =================
      const ALLOWED_APP_STATUSES = ["CLIENT_PENDING", "SUBMITTED", "IN_REVIEW"];
      const BLOCKED_APP_STATUSES = [
        "LENDER_SELECTED",
        "LENDER_APPROVED",
        "FUNDED",
        "WITHDRAWN",
      ];

      const ALLOWED_SUBMISSION_STATUSES = [
        "NEW",
        "SENT",
        "CLIENT_PENDING",
      ];

      try {
        /* ================= APPLICATION ================= */
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

        if (BLOCKED_APP_STATUSES.includes(application.status)) {
          return reply.code(400).send({
            success: false,
            message:
              "Application is finalized and cannot be sent to more lenders",
          });
        }

        if (!ALLOWED_APP_STATUSES.includes(application.status)) {
          return reply.code(400).send({
            success: false,
            message:
              "Application must be CLIENT_PENDING, SUBMITTED or IN_REVIEW before sending",
          });
        }

        /* ================= SUBMISSION ================= */
        const submission = await prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { fields: true },
        });

        if (!submission || submission.applicationId !== applicationId) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found for this application",
          });
        }

        if (!ALLOWED_SUBMISSION_STATUSES.includes(submission.status)) {
          return reply.code(400).send({
            success: false,
            message: "Submission cannot be sent in current status",
          });
        }

        /* ================= LENDER PRODUCTS ================= */
        const lenderProducts = await prisma.lenderProduct.findMany({
          where: {
            id: { in: lenderProductIds },
            isActive: true,
            loanProductCode: application.loanProductCode,
            lender: {
              type: "LENDER",
              status: "ACTIVE",
              isDeleted: false,
            },
          },
          include: { lender: true },
        });

        if (lenderProducts.length !== lenderProductIds.length) {
          return reply.code(400).send({
            success: false,
            message:
              "One or more lender products are invalid, inactive, or incompatible",
          });
        }

        /* ================= DUPLICATE CHECK ================= */
        const alreadySent = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: applicationId,
            lenderProductId: { in: lenderProductIds },
          },
          select: { lenderProductId: true },
        });

        const alreadySentIds = new Set(
          alreadySent.map((a) => a.lenderProductId)
        );

        const newLenderProducts = lenderProducts.filter(
          (lp) => !alreadySentIds.has(lp.id)
        );

        if (!newLenderProducts.length) {
          return reply.code(400).send({
            success: false,
            message:
              "All selected lenders have already received this submission",
          });
        }

        /* ================= TRANSACTION ================= */
        const results = await prisma.$transaction(
          async (tx) => {
            const processed = [];

            for (const lp of newLenderProducts) {
              // 🔹 Create lender entry
              await tx.applicationLender.create({
                data: {
                  loanApplicationId: applicationId,
                  lenderOrgId: lp.lenderOrgId,
                  lenderProductId: lp.id,
                  sentByUserId: userId,
                  sentAt: new Date(),
                  status: "SENT",
                },
              });

              // 🔹 Create notification
              await tx.notification.create({
                data: {
                  eventType: "APPLICATION_SENT",
                  category: "APPLICATION",
                  channel: "IN_APP",
                  status: "SENT",
                  recipientType: "LENDER",
                  recipientOrgId: lp.lenderOrgId,
                  subject: "New Loan Application Received",
                  body: `A new loan application has been submitted for ${application.loanProductCode}.`,
                  metadata: {
                    applicationId,
                    submissionId,
                    lenderProductId: lp.id,
                    loanProductCode: application.loanProductCode,
                  },
                },
              });

              processed.push({
                lenderProductId: lp.id,
                lenderOrgId: lp.lenderOrgId,
                lenderEmail: lp.lender.email,
                status: "SENT",
              });
            }

            // 🔹 Application status update
            if (["SUBMITTED", "CLIENT_PENDING"].includes(application.status)) {
              await tx.loanApplication.update({
                where: { id: applicationId },
                data: { status: "IN_REVIEW" },
              });
            }

            // 🔹 Submission status update (IMPORTANT FIX)
            if (
              ["NEW", "CLIENT_PENDING"].includes(submission.status)
            ) {
              await tx.applicationSubmission.update({
                where: { id: submissionId },
                data: { status: "SENT" },
              });
            }

            return processed;
          },
          { isolationLevel: "Serializable" }
        );

        /* ================= EMAIL ================= */
        for (const r of results) {
          if (r.status === "SENT" && r.lenderEmail) {
            try {
              const pdfBuffer = await generateApplicationPDF(
                application,
                submission
              );

              const base64PDF = pdfBuffer.toString("base64");

              await sendMail({
                to: r.lenderEmail,
                subject: "New Loan Application Submission",
                text:
                  "A new loan application has been submitted. Please find the attached PDF.",
                attachments: [
                  {
                    filename: `Loan-Application-${application.id}.pdf`,
                    content: base64PDF,
                    encoding: "base64",
                    contentType: "application/pdf",
                  },
                ],
              });

              fastify.log.info(
                `Application email sent to ${r.lenderEmail}`
              );
            } catch (err) {
              fastify.log.error(
                `Email failed for ${r.lenderEmail}`,
                err
              );
            }
          }
        }

        return reply.send({
          success: true,
          message: "Submission processed successfully",
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