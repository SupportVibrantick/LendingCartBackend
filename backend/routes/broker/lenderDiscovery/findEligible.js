// broker/lenderDiscovery/findEligible.js

module.exports = async function findEligibleLenders(fastify) {
  fastify.get(
    "/applications/submissions/:submissionId/eligible",
    async (req, reply) => {
      const { submissionId } = req.params;
      const prisma = fastify.prisma;

      /* =====================================================
         1. FETCH SUBMISSION + APPLICATION
      ===================================================== */

      const submission = await prisma.applicationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          application: true,
          fields: true,
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

      /* =====================================================
         2. EXTRACT & NORMALIZE BORROWER DATA
      ===================================================== */

      const getFieldValue = (key) =>
        submission.fields.find((f) => f.fieldKey === key)?.value;

      // LOAN AMOUNT
      const loanAmount =
        Number(getFieldValue("amountRequested")) ||
        Number(getFieldValue("loan_amount_requested")) ||
        Number(application.amountRequested) ||
        null;

      /* ===============================
         TERM LOGIC (VERY IMPORTANT FIX)
      =============================== */

      let termMonths = null;

      // Case 1: loan_term like "10 Years"
      const loanTermLabel = getFieldValue("loan_term");
      if (loanTermLabel) {
        const years = parseInt(loanTermLabel);
        if (!isNaN(years)) {
          termMonths = years * 12;
        }
      }

      // Case 2: requested_term_months
      if (!termMonths) {
        const directMonths = Number(
          getFieldValue("requested_term_months")
        );
        if (directMonths) termMonths = directMonths;
      }

      // Case 3: requested_term_years
      if (!termMonths) {
        const termYears = Number(
          getFieldValue("requested_term_years")
        );
        if (termYears) termMonths = termYears * 12;
      }

      // Case 4: minTermMonths + maxTermMonths (range support)
      const borrowerMinTerm = Number(getFieldValue("minTermMonths")) || null;
      const borrowerMaxTerm = Number(getFieldValue("maxTermMonths")) || null;

      /* ===============================
         CREDIT SCORE FIX
      =============================== */

      let creditScore =
        Number(getFieldValue("credit_score")) ||
        Number(application.creditScore) ||
        null;

      // If using creditScoreRange like "740-799"
      if (!creditScore) {
        const range = getFieldValue("creditScoreRange");
        if (range && typeof range === "string") {
          const minRange = parseInt(range.split("-")[0]);
          if (!isNaN(minRange)) creditScore = minRange;
        }
      }

      const { loanProductCode } = application;

      /* =====================================================
         3. FETCH ACTIVE LENDER PRODUCTS
      ===================================================== */

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

      /* =====================================================
         4. EVALUATE ELIGIBILITY
      ===================================================== */

      const evaluatedLenders = lenderProducts.map((lp) => {
        const reasons = [];

        const minLoan = lp.minLoanAmount
          ? Number(lp.minLoanAmount)
          : null;
        const maxLoan = lp.maxLoanAmount
          ? Number(lp.maxLoanAmount)
          : null;

        /* ---------- LOAN AMOUNT CHECK ---------- */

        if (loanAmount) {
          if (minLoan && loanAmount < minLoan) {
            reasons.push(`Loan amount below minimum (${minLoan})`);
          }

          if (maxLoan && loanAmount > maxLoan) {
            reasons.push(`Loan amount exceeds maximum (${maxLoan})`);
          }
        }

        /* ---------- TERM CHECK ---------- */

        if (termMonths) {
          if (lp.minTermMonths && termMonths < lp.minTermMonths) {
            reasons.push(
              `Term below minimum (${lp.minTermMonths} months)`
            );
          }

          if (lp.maxTermMonths && termMonths > lp.maxTermMonths) {
            reasons.push(
              `Term exceeds maximum (${lp.maxTermMonths} months)`
            );
          }
        }

        // Range-based term support
        if (!termMonths && (borrowerMinTerm || borrowerMaxTerm)) {
          if (
            borrowerMinTerm &&
            lp.maxTermMonths &&
            borrowerMinTerm > lp.maxTermMonths
          ) {
            reasons.push("Requested term range not supported");
          }

          if (
            borrowerMaxTerm &&
            lp.minTermMonths &&
            borrowerMaxTerm < lp.minTermMonths
          ) {
            reasons.push("Requested term range not supported");
          }
        }

        /* ---------- CREDIT SCORE CHECK ---------- */

        if (creditScore && lp.minCreditScore) {
          if (creditScore < lp.minCreditScore) {
            reasons.push(
              `Credit score below minimum (${lp.minCreditScore})`
            );
          }
        }

        const isEligible = reasons.length === 0;

        return {
          lenderOrgId: lp.lenderOrgId,
          lenderName: lp.lender.name,
          lenderProductId: lp.id,
          loanProductCode: lp.loanProductCode,

          fundingRange: {
            min: minLoan,
            max: maxLoan,
          },

          terms: {
            minMonths: lp.minTermMonths,
            maxMonths: lp.maxTermMonths,
          },

          minCreditScore: lp.minCreditScore,
          interestRateRange: lp.interestRateRange,

          eligible: isEligible,
          rejectionReasons: isEligible ? [] : reasons,
        };
      });

      /* =====================================================
         5. SPLIT ELIGIBLE / REJECTED
      ===================================================== */

      const eligibleLenders = evaluatedLenders.filter(
        (l) => l.eligible
      );

      const rejectedLenders = evaluatedLenders.filter(
        (l) => !l.eligible
      );

      /* =====================================================
         6. FINAL RESPONSE
      ===================================================== */

      return reply.send({
        success: true,
        data: {
          submissionId,
          applicationId: application.id,

          borrowerData: {
            loanAmount,
            termMonths,
            borrowerMinTerm,
            borrowerMaxTerm,
            creditScore,
          },

          totalEligibleLenders: eligibleLenders.length,
          totalRejectedLenders: rejectedLenders.length,

          eligibleLenders,
          rejectedLenders,
        },
      });
    }
  );
};