/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderDecisionRoutes(fastify) {
  fastify.patch(
    "/:applicationLenderId/decision",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Approve or Decline loan application",
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
              enum: ["APPROVED", "DECLINED"],
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
        // ====================================================
        // 1️⃣ AUTH VALIDATION
        // ====================================================
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

        // ====================================================
        // 2️⃣ FETCH APPLICATION (SECURED)
        // ====================================================
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

        // Prevent double decision
        if (["APPROVED", "DECLINED"].includes(record.status)) {
          return reply.status(400).send({
            success: false,
            message: "Application already decided",
          });
        }

        // ====================================================
        // 3️⃣ STATUS MAPPING (STRICT ENUM SAFE)
        // ====================================================
        const lenderStatus =
          decision === "APPROVED"
            ? "APPROVED"
            : "DECLINED";

        const loanStatus =
          decision === "APPROVED"
            ? "LENDER_APPROVED"
            : "LENDER_DECLINED";

        const previousLoanStatus = record.loanApplication.status;

        // ====================================================
        // 4️⃣ DATABASE TRANSACTION
        // ====================================================
        await prisma.$transaction(async (tx) => {
          // Update ApplicationLender
          await tx.applicationLender.update({
            where: { id: applicationLenderId },
            data: {
              status: lenderStatus,
              lastUpdatedAt: new Date(),
            },
          });

          // Create LenderReview
          await tx.lenderReview.create({
            data: {
              applicationLenderId,
              reviewedByUserId: userId,
              reviewStatus: lenderStatus,
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

          // Update LoanApplication main status
          await tx.loanApplication.update({
            where: { id: record.loanApplicationId },
            data: {
              status: loanStatus,
            },
          });

          // Insert Status History
          await tx.applicationStatusHistory.create({
            data: {
              loanApplicationId: record.loanApplicationId,
              fromStatus: previousLoanStatus,
              toStatus: loanStatus,
              changedByUserId: userId,
              reason: notes || null,
            },
          });
        });

        return reply.send({
          success: true,
          message: `Application ${decision} successfully`,
        });
      } catch (error) {
        fastify.log.error({
          message: "Error updating lender decision",
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