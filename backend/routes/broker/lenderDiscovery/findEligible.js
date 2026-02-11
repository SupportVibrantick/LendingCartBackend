// broker/lenderDiscovery/findEligible.js

module.exports = async function findEligibleLenders(fastify) {
  fastify.get(
    "/applications/submissions/:submissionId/eligible",
    async (req, reply) => {
      const { submissionId } = req.params;
      const prisma = fastify.prisma;

      /* ===============================
         1. FETCH SUBMISSION
      =============================== */

      const submission = await prisma.applicationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          application: true,
          fields: true, // VERY IMPORTANT
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

      /* ===============================
         2. EXTRACT VALUES FROM FIELDS
      =============================== */

      const getFieldValue = (key) => {
        return submission.fields.find((f) => f.fieldKey === key)?.value;
      };

      const loanAmount =
        Number(getFieldValue("amountRequested")) ||
        Number(getFieldValue("loan_amount_requested"));

      const termYears = Number(getFieldValue("requested_term_years"));
      const termMonths = termYears ? termYears * 12 : null;

      const creditScore = Number(getFieldValue("credit_score")); // ensure this exists

      const { loanProductCode } = application;

      /* ===============================
         3. FETCH ACTIVE LENDER PRODUCTS
      =============================== */

      const lenderProducts = await prisma.lenderProduct.findMany({
        where: {
          isActive: true,
          loanProductCode,

          lender: {
            type: "LENDER",
            status: "ACTIVE",
            isDeleted: false,
          },
        },
        include: {
          lender: {
            include: {
              lenderProfile: true,
            },
          },
        },
      });

      /* ===============================
         4. MANUAL ELIGIBILITY CHECK
      =============================== */

      const eligibleLenders = lenderProducts.filter((lp) => {
        // Loan Amount Check
        if (
          loanAmount &&
          ((lp.minLoanAmount && loanAmount < Number(lp.minLoanAmount)) ||
            (lp.maxLoanAmount && loanAmount > Number(lp.maxLoanAmount)))
        ) {
          return false;
        }

        // Term Check
        if (
          termMonths &&
          ((lp.minTermMonths && termMonths < lp.minTermMonths) ||
            (lp.maxTermMonths && termMonths > lp.maxTermMonths))
        ) {
          return false;
        }

        // Credit Score Check
        if (
          creditScore &&
          lp.minCreditScore &&
          creditScore < lp.minCreditScore
        ) {
          return false;
        }

        return true;
      });

      /* ===============================
         5. FORMAT RESPONSE
      =============================== */

      const lenders = eligibleLenders.map((lp) => ({
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

        minCreditScore: lp.minCreditScore,

        interestRateRange: lp.interestRateRange,
      }));

      /* ===============================
         6. RESPONSE
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