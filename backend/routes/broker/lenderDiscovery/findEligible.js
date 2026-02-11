// broker/lenderDiscovery/findEligible.js
module.exports = async function findEligibleLenders(fastify) {
  fastify.get(
    "/applications/submissions/:submissionId/eligible",
    async (req, reply) => {
      const { submissionId } = req.params;
      const prisma = fastify.prisma;

      /* ===============================
         1. FETCH SUBMISSION + APPLICATION
      =============================== */
      const submission = await prisma.applicationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          application: {
            include: {
              financials: true,
            },
          },
        },
      });

      if (!submission) {
        return reply.code(404).send({
          success: false,
          message: "Submission not found",
        });
      }

      const application = submission.application;

      if (application.status !== "SUBMITTED") {
        return reply.code(400).send({
          success: false,
          message: "Application must be SUBMITTED",
        });
      }

      const { loanProductCode, amountRequested } = application;

      /* ===============================
         2. DISCOVER LENDER PRODUCTS
         (NO BROKER CONNECTION REQUIRED)
      =============================== */
      const lenderProducts = await prisma.lenderProduct.findMany({
        where: {
          isActive: true,
          loanProductCode,

          AND: [
            amountRequested
              ? {
                  OR: [
                    { minLoanAmount: null },
                    { minLoanAmount: { lte: amountRequested } },
                  ],
                }
              : {},

            amountRequested
              ? {
                  OR: [
                    { maxLoanAmount: null },
                    { maxLoanAmount: { gte: amountRequested } },
                  ],
                }
              : {},
          ],

          lender: {
            type: "LENDER",
            status: "ACTIVE",
            isDeleted: false,
            lenderProfile: {
              isVisible: true,
              profileStatus: "COMPLETED",
            },
          },
        },

        include: {
          lender: {
            include: {
              lenderProfile: true,
            },
          },
          eligibilityRuleSets: {
            include: {
              applicationRuleEvaluations: {
                where: {
                  submissionId,
                },
                include: {
                  results: true,
                },
              },
            },
          },
        },
      });

      /* ===============================
         3. FORMAT RESPONSE
      =============================== */
      const lenders = lenderProducts.map((lp) => {
        const profile = lp.lender.lenderProfile;

        const evaluation =
          lp.eligibilityRuleSets?.[0]?.applicationRuleEvaluations?.[0] ?? null;

        return {
          lenderOrgId: lp.lenderOrgId,
          lenderName: lp.lender.name,

          lenderProductId: lp.id,
          loanProductCode: lp.loanProductCode,

          fundingRange: {
            min: lp.minLoanAmount,
            max: lp.maxLoanAmount,
          },

          terms: {
            minMonths: lp.minTermMonths,
            maxMonths: lp.maxTermMonths,
          },

          interestRateRange: lp.interestRateRange,

          profile: {
            summary: profile?.summary,
            fundingSpeedDays: profile?.fundingSpeedDays,
          },

          eligibility: evaluation
            ? {
                status: evaluation.result,
                rules: evaluation.results.map((r) => ({
                  passed: r.passed,
                  message: r.message,
                  value: r.fieldValue,
                })),
              }
            : {
                status: "NOT_EVALUATED",
                rules: [],
              },
        };
      });

      /* ===============================
         4. RESPONSE
      =============================== */
      return reply.send({
        success: true,
        data: {
          submissionId,
          applicationId: application.id,
          totalEligibleLenders: lenders.length,
          lenders,
        },
      });
    }
  );
};