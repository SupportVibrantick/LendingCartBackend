/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderDecisionRoutes(fastify) {
  fastify.patch(
    "/:applicationLenderId/decision",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Lender decision (Conditional / Approved / Declined)",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["decision"],
          properties: {
            decision: {
              type: "string",
              enum: ["CONDITIONAL", "APPROVED", "DECLINED"],
            },
            approvedAmount: { type: "number" },
            interestRate: { type: "number" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // =====================================================
        // AUTH CHECK
        // =====================================================
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const userId = req.user.id;

        const { applicationLenderId } = req.params;
        const { decision, approvedAmount, interestRate, notes } = req.body;

        // =====================================================
        // FETCH SECURED RECORD
        // =====================================================
        const record = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId,
          },
          include: {
            loanApplication: true,
          },
        });

        if (!record) {
          return reply.status(404).send({
            success: false,
            message: "Application not found for this lender",
          });
        }

        if (["APPROVED", "DECLINED"].includes(record.status)) {
          return reply.status(400).send({
            success: false,
            message: "Final decision already made",
          });
        }

        let lenderStatus;
        let reviewStatus;

        switch (decision) {
          case "CONDITIONAL":
            lenderStatus = "IN_REVIEW";
            reviewStatus = "CONDITIONAL";
            break;
          case "APPROVED":
            lenderStatus = "APPROVED";
            reviewStatus = "APPROVED";
            break;
          case "DECLINED":
            lenderStatus = "DECLINED";
            reviewStatus = "DECLINED";
            break;
          default:
            return reply.status(400).send({
              success: false,
              message: "Invalid decision value",
            });
        }

        const previousLoanStatus = record.loanApplication.status;

        // =====================================================
        // TRANSACTION (ATOMIC & SAFE)
        // =====================================================
        await prisma.$transaction(async (tx) => {
          // Update lender mapping
          await tx.applicationLender.update({
            where: { id: applicationLenderId },
            data: {
              status: lenderStatus,
              lastUpdatedAt: new Date(),
            },
          });

          // Create lender review
          await tx.lenderReview.create({
            data: {
              applicationLenderId,
              reviewedByUserId: userId,
              reviewStatus,
              approvedAmount:
                decision === "APPROVED" && approvedAmount
                  ? approvedAmount
                  : null,
              interestRate:
                decision === "APPROVED" && interestRate
                  ? interestRate
                  : null,
              notes: notes || null,
            },
          });

          // =====================================================
          // CONDITIONAL → CREATE DOCUMENT REQUESTS
          // =====================================================
          if (decision === "CONDITIONAL") {
            if (!record.lenderProductId) {
              throw new Error(
                "Lender product not associated with this application"
              );
            }

            // Fetch lender document template
            const lenderRequirements =
              await tx.lenderDocumentRequirement.findMany({
                where: {
                  lenderProductId: record.lenderProductId,
                },
              });

            // Prevent duplicate injection
            const existingRequirements =
              await tx.applicationDocumentRequirement.findMany({
                where: {
                  loanApplicationId: record.loanApplicationId,
                  source: "LENDER_DEFAULT",
                },
                select: {
                  documentTypeId: true,
                },
              });

            const existingDocTypeIds = new Set(
              existingRequirements.map((r) => r.documentTypeId)
            );

            const newRequirements = lenderRequirements
              .filter((req) => !existingDocTypeIds.has(req.documentTypeId))
              .map((req) => ({
                loanApplicationId: record.loanApplicationId,
                documentTypeId: req.documentTypeId,
                source: "LENDER_DEFAULT",
                isRequired: req.isRequired,
                status: "PENDING",
              }));

            if (newRequirements.length > 0) {
              await tx.applicationDocumentRequirement.createMany({
                data: newRequirements,
              });
            }

            // Move loan into review stage
            if (previousLoanStatus !== "IN_REVIEW") {
              await tx.loanApplication.update({
                where: { id: record.loanApplicationId },
                data: { status: "IN_REVIEW" },
              });

              await tx.applicationStatusHistory.create({
                data: {
                  loanApplicationId: record.loanApplicationId,
                  fromStatus: previousLoanStatus,
                  toStatus: "IN_REVIEW",
                  changedByUserId: userId,
                  reason: "Conditional approval - documents requested",
                },
              });
            }
          }

          // =====================================================
          //  DECLINE LOGIC (ALL LENDERS DECLINED)
          // =====================================================
          if (decision === "DECLINED") {
            const remaining = await tx.applicationLender.count({
              where: {
                loanApplicationId: record.loanApplicationId,
                status: { notIn: ["DECLINED"] },
              },
            });

            if (remaining === 0) {
              await tx.loanApplication.update({
                where: { id: record.loanApplicationId },
                data: { status: "LENDER_DECLINED" },
              });

              await tx.applicationStatusHistory.create({
                data: {
                  loanApplicationId: record.loanApplicationId,
                  fromStatus: previousLoanStatus,
                  toStatus: "LENDER_DECLINED",
                  changedByUserId: userId,
                  reason: "All lenders declined",
                },
              });
            }
          }
        });

        return reply.send({
          success: true,
          message: `Application ${decision} processed successfully`,
        });
      } catch (error) {
        fastify.log.error({
          message: "Error processing lender decision",
          error,
        });

        return reply.status(500).send({
          success: false,
          message: "Server error while processing decision",
        });
      }
    }
  );
}

module.exports = lenderDecisionRoutes;