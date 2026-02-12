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
        /* ===============================
           1️⃣ VALIDATE APPLICATION
        =============================== */
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

        if (application.status !== "SUBMITTED") {
          return reply.code(400).send({
            success: false,
            message: "Application must be SUBMITTED before sending",
          });
        }

        /* ===============================
           2️⃣ VALIDATE SUBMISSION
        =============================== */
        const submission = await prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
        });

        if (!submission || submission.applicationId !== applicationId) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found for this application",
          });
        }

        if (submission.status !== "NEW") {
          return reply.code(400).send({
            success: false,
            message: "Submission already sent",
          });
        }

        /* ===============================
           3️⃣ VALIDATE LENDER PRODUCTS
        =============================== */
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
        });

        if (lenderProducts.length !== lenderProductIds.length) {
          return reply.code(400).send({
            success: false,
            message:
              "One or more lender products are invalid, inactive, or incompatible",
          });
        }

        /* ===============================
           4️⃣ TRANSACTION
        =============================== */
        const results = await prisma.$transaction(async (tx) => {
          const processed = [];

          for (const lp of lenderProducts) {
            const existing = await tx.applicationLender.findFirst({
              where: {
                loanApplicationId: applicationId,
                lenderProductId: lp.id,
              },
            });

            if (existing) {
              processed.push({
                lenderProductId: lp.id,
                lenderOrgId: lp.lenderOrgId,
                status: "ALREADY_SENT",
              });
              continue;
            }

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
              status: "SENT",
            });
          }

          const sentNow = processed.some((r) => r.status === "SENT");

          if (sentNow) {
            //  Update Application Status
            await tx.loanApplication.update({
              where: { id: applicationId },
              data: {
                status: "IN_REVIEW",
              },
            });

            //  Update Submission Status
            await tx.applicationSubmission.update({
              where: { id: submissionId },
              data: {
                status: "SENT",
              },
            });

            //  Status History
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

          return processed;
        });

        return reply.send({
          success: true,
          message: "Submission sent to lenders successfully",
          data: {
            applicationId,
            submissionId,
            totalRequested: lenderProductIds.length,
            totalProcessed: results.length,
            results,
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};