// broker/lenderDiscovery/findEligible.js

module.exports = async function findEligibleLenders(fastify) {
  fastify.get(
    "/applications/submissions/:submissionId/eligible",
    {
      schema: {
        tags: ["Broker -> Lender Discovery"],
        summary: "Find eligible lenders for a submission",
        params: {
          type: "object",
          required: ["submissionId"],
          properties: {
            submissionId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { submissionId } = req.params;

      try {
        /* =====================================================
           1️⃣ AUTHORIZATION
        ===================================================== */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* =====================================================
           2️⃣ FETCH SUBMISSION + APPLICATION
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

        if (!application) {
          return reply.code(500).send({
            success: false,
            message: "Application data corrupted",
          });
        }

        if (application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "You do not own this application",
          });
        }

        if (application.status === "DRAFT") {
          return reply.code(400).send({
            success: false,
            message: "Application must be submitted first",
          });
        }

        /* =====================================================
           3️⃣ EXTRACT BORROWER DATA SAFELY
        ===================================================== */

        const getFieldValue = (key) =>
          submission.fields.find((f) => f.fieldKey === key)?.value;

        const safeNumber = (value) => {
          const n = Number(value);
          return isNaN(n) ? null : n;
        };

        const loanAmount =
          safeNumber(getFieldValue("amountRequested")) ??
          safeNumber(application.amountRequested);

        const termMonths = safeNumber(
          getFieldValue("requested_term_months")
        );

        const borrowerMinTerm = safeNumber(
          getFieldValue("minTermMonths")
        );

        const borrowerMaxTerm = safeNumber(
          getFieldValue("maxTermMonths")
        );

        let creditScore =
          safeNumber(getFieldValue("credit_score")) ?? null;

        if (!creditScore) {
          const range = getFieldValue("creditScoreRange");
          if (range && typeof range === "string") {
            const minRange = parseInt(range.split("-")[0]);
            creditScore = isNaN(minRange) ? null : minRange;
          }
        }

        const { loanProductCode } = application;

        /* =====================================================
           4️⃣ EXCLUDE ALREADY SENT LENDERS (🔥 FIX)
        ===================================================== */

        const alreadySent = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: application.id,
          },
          select: {
            lenderProductId: true,
          },
        });

        const sentProductIds = new Set(
          alreadySent
            .map((a) => a.lenderProductId)
            .filter(Boolean)
        );

        /* =====================================================
           5️⃣ FETCH ACTIVE LENDER PRODUCTS
        ===================================================== */

        const lenderProducts = await prisma.lenderProduct.findMany({
          where: {
            isActive: true,
            loanProductCode,
            id: {
              notIn: [...sentProductIds], // 🔥 CRITICAL FIX
            },
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

        if (!lenderProducts.length) {
          return reply.send({
            success: true,
            data: {
              submissionId,
              applicationId: application.id,
              totalEligibleLenders: 0,
              totalRejectedLenders: 0,
              eligibleLenders: [],
              rejectedLenders: [],
            },
          });
        }

        /* =====================================================
           6️⃣ ELIGIBILITY EVALUATION
        ===================================================== */

        const evaluatedLenders = lenderProducts.map((lp) => {
          const reasons = [];

          const minLoan = lp.minLoanAmount
            ? Number(lp.minLoanAmount)
            : null;

          const maxLoan = lp.maxLoanAmount
            ? Number(lp.maxLoanAmount)
            : null;

          if (loanAmount) {
            if (minLoan && loanAmount < minLoan)
              reasons.push(`Loan below minimum (${minLoan})`);

            if (maxLoan && loanAmount > maxLoan)
              reasons.push(`Loan exceeds maximum (${maxLoan})`);
          }

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
            profileImage: lender.users[0]?.profileImage ?? null,
            lenderProfile: lender.lenderProfile ?? null,
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
           7️⃣ SUCCESS RESPONSE
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
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            submissionId,
            brokerOrgId: req.user?.organizationId,
          },
          "Eligibility evaluation failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while evaluating lenders",
        });
      }
    }
  );
};