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
      const { applicationId, submissionId } = req.params;
      const { lenderProductIds } = req.body;

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const userId = req.user.id;
      const brokerOrgId = req.user.organizationId;

      try {
        /* =====================================================
           1️⃣ VALIDATE APPLICATION
        ===================================================== */
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

        if (
          [
            "LENDER_SELECTED",
            "LENDER_APPROVED",
            "FUNDED",
            "WITHDRAWN",
          ].includes(application.status)
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "Application is finalized and cannot be sent to more lenders",
          });
        }

        if (!["SUBMITTED", "IN_REVIEW"].includes(application.status)) {
          return reply.code(400).send({
            success: false,
            message:
              "Application must be SUBMITTED or IN_REVIEW before sending",
          });
        }

        /* =====================================================
           2️⃣ VALIDATE SUBMISSION
        ===================================================== */
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

        if (!["NEW", "SENT"].includes(submission.status)) {
          return reply.code(400).send({
            success: false,
            message: "Submission cannot be sent in current status",
          });
        }

        /* =====================================================
           3️⃣ VALIDATE LENDER PRODUCTS
        ===================================================== */
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
          include: {
            lender: true,
          },
        });

        if (lenderProducts.length !== lenderProductIds.length) {
          return reply.code(400).send({
            success: false,
            message:
              "One or more lender products are invalid, inactive, or incompatible",
          });
        }

        /* =====================================================
           4️⃣ PREVENT DUPLICATES
        ===================================================== */
        const alreadySent = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: applicationId,
            lenderProductId: { in: lenderProductIds },
          },
          select: { lenderProductId: true },
        });

        const alreadySentIds = new Set(
          alreadySent.map((a) => a.lenderProductId),
        );

        const newLenderProducts = lenderProducts.filter(
          (lp) => !alreadySentIds.has(lp.id),
        );

        if (!newLenderProducts.length) {
          return reply.code(400).send({
            success: false,
            message:
              "All selected lenders have already received this submission",
          });
        }

        /* =====================================================
           5️⃣ DATABASE TRANSACTION
        ===================================================== */
        const results = await prisma.$transaction(
          async (tx) => {
            const processed = [];

            for (const lp of newLenderProducts) {
              try {
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

                processed.push({
                  lenderProductId: lp.id,
                  lenderOrgId: lp.lenderOrgId,
                  lenderEmail: lp.lender.email,
                  status: "SENT",
                });
              } catch (err) {
                if (err.code === "P2002") {
                  processed.push({
                    lenderProductId: lp.id,
                    lenderOrgId: lp.lenderOrgId,
                    lenderEmail: lp.lender.email,
                    status: "ALREADY_SENT",
                  });
                } else {
                  throw err;
                }
              }
            }

            const newlySent = processed.some((r) => r.status === "SENT");

            if (newlySent && application.status === "SUBMITTED") {
              await tx.loanApplication.update({
                where: { id: applicationId },
                data: { status: "IN_REVIEW" },
              });

              await tx.applicationStatusHistory.create({
                data: {
                  loanApplicationId: applicationId,
                  fromStatus: "SUBMITTED",
                  toStatus: "IN_REVIEW",
                  changedByUserId: userId,
                  reason: "Sent to lenders",
                },
              });
            }

            if (newlySent && submission.status === "NEW") {
              await tx.applicationSubmission.update({
                where: { id: submissionId },
                data: { status: "SENT" },
              });
            }

            return processed;
          },
          { isolationLevel: "Serializable" },
        );

        /* =====================================================
           6️⃣ SEND EMAIL WITH PDF (OUTSIDE TRANSACTION)
        ===================================================== */
        for (const r of results) {
          if (r.status === "SENT" && r.lenderEmail) {
            try {
              const pdfBuffer = await generateApplicationPDF(
                application,
                submission,
              );

              await sendMail({
                to: r.lenderEmail,
                subject: "New Loan Application Submission",
                text: "A new loan application has been submitted. Please find the attached PDF.",
                attachments: [
                  {
                    filename: `Loan-Application-${application.id}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                  },
                ],
              });

              fastify.log.info(`Application email sent to ${r.lenderEmail}`);
            } catch (emailError) {
              fastify.log.error(
                `Email failed for ${r.lenderEmail}`,
                emailError,
              );
            }
          }
        }

        /* =====================================================
           7️⃣ SUCCESS RESPONSE
        ===================================================== */
        return reply.send({
          success: true,
          message: "Submission processed successfully",
          data: {
            applicationId,
            submissionId,
            totalRequested: lenderProductIds.length,
            totalProcessed: results.length,
            results,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, applicationId, submissionId },
          "Send to lenders failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
