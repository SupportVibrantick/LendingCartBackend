// broker/lenderDiscovery/findEligible.js

module.exports = async function findEligibleLenders(fastify) {
  fastify.get(
    "/applications/submissions/:submissionId/eligible",
    async (req, reply) => {
      const { submissionId } = req.params;
      const prisma = fastify.prisma;

      /* =====================================================
         1. FETCH SUBMISSION
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

      const getFieldValue = (key) =>
        submission.fields.find((f) => f.fieldKey === key)?.value;

      const loanAmount =
        Number(getFieldValue("amountRequested")) ||
        Number(application.amountRequested) ||
        null;

      const termMonths =
        Number(getFieldValue("requested_term_months")) || null;

      const borrowerMinTerm =
        Number(getFieldValue("minTermMonths")) || null;

      const borrowerMaxTerm =
        Number(getFieldValue("maxTermMonths")) || null;

      let creditScore =
        Number(getFieldValue("credit_score")) ||
        Number(application.creditScore) ||
        null;

      if (!creditScore) {
        const range = getFieldValue("creditScoreRange");
        if (range && typeof range === "string") {
          const minRange = parseInt(range.split("-")[0]);
          if (!isNaN(minRange)) creditScore = minRange;
        }
      }

      const { loanProductCode } = application;

      /* =====================================================
         2. FETCH LENDER PRODUCTS WITH FULL PROFILE
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
              users: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profileImage: true,
                },
                take: 1,
              },
            },
          },
        },
      });

      /* =====================================================
         3. ELIGIBILITY CHECK
      ===================================================== */

      const evaluatedLenders = lenderProducts.map((lp) => {
        const reasons = [];

        const minLoan = lp.minLoanAmount
          ? Number(lp.minLoanAmount)
          : null;

        const maxLoan = lp.maxLoanAmount
          ? Number(lp.maxLoanAmount)
          : null;

        /* ---------- LOAN ---------- */

        if (loanAmount) {
          if (minLoan && loanAmount < minLoan)
            reasons.push(`Loan amount below minimum (${minLoan})`);

          if (maxLoan && loanAmount > maxLoan)
            reasons.push(`Loan amount exceeds maximum (${maxLoan})`);
        }

        /* ---------- TERM ---------- */

        if (termMonths) {
          if (lp.minTermMonths && termMonths < lp.minTermMonths)
            reasons.push(
              `Term below minimum (${lp.minTermMonths} months)`
            );

          if (lp.maxTermMonths && termMonths > lp.maxTermMonths)
            reasons.push(
              `Term exceeds maximum (${lp.maxTermMonths} months)`
            );
        }

        if (borrowerMinTerm || borrowerMaxTerm) {
          if (
            borrowerMinTerm &&
            lp.maxTermMonths &&
            borrowerMinTerm > lp.maxTermMonths
          ) {
            reasons.push(
              "Requested minimum term exceeds lender maximum"
            );
          }

          if (
            borrowerMaxTerm &&
            lp.minTermMonths &&
            borrowerMaxTerm < lp.minTermMonths
          ) {
            reasons.push(
              "Requested maximum term below lender minimum"
            );
          }
        }

        /* ---------- CREDIT SCORE ---------- */

        if (creditScore && lp.minCreditScore) {
          if (creditScore < lp.minCreditScore)
            reasons.push(
              `Credit score below minimum (${lp.minCreditScore})`
            );
        }

        const lender = lp.lender;

        return {
          lenderOrgId: lender.id,
          lenderName: lender.name,
          lenderEmail: lender.email,
          lenderPhone: lender.phone,

          profileImage:
            lender.users[0]?.profileImage || null,

          lenderProfile: lender.lenderProfile || null,

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

          eligible: reasons.length === 0,
          rejectionReasons: reasons,
        };
      });

      const eligibleLenders = evaluatedLenders.filter(
        (l) => l.eligible
      );

      const rejectedLenders = evaluatedLenders.filter(
        (l) => !l.eligible
      );

      /* =====================================================
         4. FINAL RESPONSE
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