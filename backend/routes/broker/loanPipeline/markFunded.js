const { calculateDealCommissions } = require("../../../services/calculateDealCommissions");
const { formatCommissionRecord } = require("../../../utils/commissionHelpers");
const {
  validateMarkFundedPrerequisites,
} = require("../../../utils/markFundedHelpers");

const loanIncludeForFunding = {
  feeAgreement: true,
  submissions: {
    where: { status: { not: "SUPERSEDED" } },
    orderBy: { createdAt: "desc" },
    include: {
      fields: {
        include: { builderField: true },
      },
    },
  },
  fundedApplicationLender: {
    include: {
      lenderReviews: {
        where: { reviewStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { approvedAmount: true },
      },
    },
  },
};

function formatCommissionResult(raw) {
  return {
    alreadyCalculated: raw.alreadyCalculated,
    commissionPool: raw.commissionPool,
    brokerRetained: raw.brokerRetained,
    upfrontFee: raw.upfrontFee,
    warnings: raw.warnings || [],
    commissions: (raw.commissions || []).map((row) => formatCommissionRecord(row)),
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function markFundedRoute(fastify) {
  fastify.post(
    "/:loanId/mark-funded",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Select funded lender and mark application as funded",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string", minLength: 1 },
          },
        },
        body: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
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
        const userId = req.user.id || req.user.userId;
        const loanId = String(req.params.loanId || "").trim();
        const applicationLenderId = String(
          req.body?.applicationLenderId || "",
        ).trim();

        if (!loanId || !applicationLenderId) {
          return reply.code(400).send({
            success: false,
            message: "loanId and applicationLenderId are required",
          });
        }

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanId },
          include: loanIncludeForFunding,
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        if (loan.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "You do not have access to this loan",
          });
        }

        if (loan.status === "FUNDED") {
          if (loan.fundedApplicationLenderId === applicationLenderId) {
            let commissionResult = null;
            let commissionError = null;

            try {
              const raw = await calculateDealCommissions(prisma, loanId);
              commissionResult = formatCommissionResult(raw);
            } catch (commissionCalcError) {
              commissionError =
                commissionCalcError.message || "Failed to calculate commissions";
            }

            return reply.send({
              success: true,
              message: "Application is already funded with this lender",
              data: {
                applicationId: loan.id,
                fundedApplicationLenderId: applicationLenderId,
                status: "FUNDED",
                commissions: commissionResult,
                commissionError,
              },
            });
          }

          return reply.code(409).send({
            success: false,
            message: "Application is already funded with a different lender",
          });
        }

        if (["WITHDRAWN", "SUSPENDED"].includes(loan.status)) {
          return reply.code(400).send({
            success: false,
            message: `Cannot mark as funded for status: ${loan.status}`,
          });
        }

        try {
          validateMarkFundedPrerequisites(loan);
        } catch (validationError) {
          return reply.code(400).send({
            success: false,
            message: validationError.message,
          });
        }

        const applicationLender = await prisma.applicationLender.findUnique({
          where: { id: applicationLenderId },
          include: {
            lender: { select: { id: true, name: true } },
          },
        });

        if (!applicationLender || applicationLender.loanApplicationId !== loanId) {
          return reply.code(404).send({
            success: false,
            message: "Submitted lender not found for this application",
          });
        }

        if (!applicationLender.sentAt) {
          return reply.code(400).send({
            success: false,
            message: "This lender has not been submitted for this application",
          });
        }

        if (applicationLender.status !== "APPROVED") {
          return reply.code(400).send({
            success: false,
            message: "Only approved lenders can be marked as funded",
          });
        }

        const previousStatus = loan.status;
        const fundedAt = new Date();

        const { updated, commissionRaw } = await prisma.$transaction(
          async (tx) => {
            const fundedLoan = await tx.loanApplication.update({
              where: { id: loanId },
              data: {
                status: "FUNDED",
                fundedApplicationLenderId: applicationLenderId,
                fundedAt,
                fundedByUserId: userId,
              },
              select: {
                id: true,
                status: true,
                fundedApplicationLenderId: true,
                fundedAt: true,
              },
            });

            await tx.applicationStatusHistory.create({
              data: {
                loanApplicationId: loanId,
                fromStatus: previousStatus,
                toStatus: "FUNDED",
                changedByUserId: userId,
                reason: `Funded with ${applicationLender.lender?.name || "lender"}`,
              },
            });

            await tx.applicationLender.updateMany({
              where: {
                loanApplicationId: loanId,
                id: { not: applicationLenderId },
                status: "APPROVED",
              },
              data: {
                status: "WITHDRAWN",
                lastUpdatedAt: fundedAt,
              },
            });

            const raw = await calculateDealCommissions(tx, loanId);

            return { updated: fundedLoan, commissionRaw: raw };
          },
        );

        return reply.send({
          success: true,
          message: "Application marked as funded",
          data: {
            applicationId: updated.id,
            status: updated.status,
            fundedApplicationLenderId: updated.fundedApplicationLenderId,
            fundedAt: updated.fundedAt,
            fundedLenderName: applicationLender.lender?.name || null,
            commissions: formatCommissionResult(commissionRaw),
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            loanId: req.params.loanId,
          },
          "Mark funded failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to mark application as funded",
        });
      }
    },
  );
};
