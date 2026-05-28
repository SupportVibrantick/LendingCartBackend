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
        querystring: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
            search: {
              type: "string",
              default: "",
            },
            filter: {
              type: "string",
              enum: ["all", "eligible", "rejected", "sent"],
              default: "all",
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { submissionId } = req.params;

      const {
        page: rawPage = 1,
        limit: rawLimit = 10,
        search = "",
        filter = "all",
      } = req.query;

      const page = Number(rawPage);
      const limit = Number(rawLimit);

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
           2️⃣ FETCH SUBMISSION
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
            message: "Unauthorized access to this application",
          });
        }

        if (application.status === "DRAFT") {
          return reply.code(400).send({
            success: false,
            message: "Application must be submitted first",
          });
        }

        /* =====================================================
           3️⃣ SAFE FIELD EXTRACTION
        ===================================================== */

        const extractValue = (val) => {
          if (!val) return null;
          if (typeof val === "object") {
            return val?.value || val?.text || val?.label || null;
          }
          return val;
        };

        const getFieldValue = (key) => {
          const field = submission.fields.find((f) => f.fieldKey === key);
          return extractValue(field?.value);
        };

        const safeNumber = (value) => {
          const n = Number(value);
          return isNaN(n) ? null : n;
        };

        const loanAmount =
          safeNumber(getFieldValue("amountRequested")) ??
          safeNumber(application.amountRequested);

        const termMonths = safeNumber(getFieldValue("requested_term_months"));

        const borrowerMinTerm = safeNumber(getFieldValue("minTermMonths"));

        const borrowerMaxTerm = safeNumber(getFieldValue("maxTermMonths"));

        let creditScore = safeNumber(getFieldValue("credit_score")) ?? null;

        if (!creditScore) {
          const range = getFieldValue("creditScoreRange");
          if (range && typeof range === "string") {
            const minRange = parseInt(range.split("-")[0]);
            creditScore = isNaN(minRange) ? null : minRange;
          }
        }

        const { loanProductCode } = application;

        /* =====================================================
           4️⃣ FETCH ALREADY SENT LENDERS
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
          alreadySent.map((a) => a.lenderProductId).filter(Boolean),
        );

        /* =====================================================
           5️⃣ FETCH ALL ACTIVE LENDER PRODUCTS (NO EXCLUSION)
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

        if (!lenderProducts.length) {
          return reply.send({
            success: true,
            data: {
              submissionId,
              applicationId: application.id,
              totalEligibleLenders: 0,
              totalRejectedLenders: 0,
              totalAlreadySentLenders: 0,
              eligibleLenders: [],
              rejectedLenders: [],
              alreadySentLenders: [],
            },
          });
        }

        /* =====================================================
           6️⃣ ELIGIBILITY EVALUATION
        ===================================================== */

        const evaluatedLenders = lenderProducts.map((lp) => {
          const reasons = [];

          const isAlreadySent = sentProductIds.has(lp.id);

          const minLoan = lp.minLoanAmount ? Number(lp.minLoanAmount) : null;

          const maxLoan = lp.maxLoanAmount ? Number(lp.maxLoanAmount) : null;

          if (loanAmount !== null) {
            if (minLoan && loanAmount < minLoan)
              reasons.push(`Loan below minimum (${minLoan})`);

            if (maxLoan && loanAmount > maxLoan)
              reasons.push(`Loan exceeds maximum (${maxLoan})`);
          }

          if (termMonths !== null) {
            if (lp.minTermMonths && termMonths < lp.minTermMonths)
              reasons.push(`Term below minimum (${lp.minTermMonths} months)`);

            if (lp.maxTermMonths && termMonths > lp.maxTermMonths)
              reasons.push(`Term exceeds maximum (${lp.maxTermMonths} months)`);
          }

          if (creditScore !== null && lp.minCreditScore) {
            if (creditScore < lp.minCreditScore)
              reasons.push(`Credit score below minimum (${lp.minCreditScore})`);
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

            // 🔥 FLAGS
            alreadySent: isAlreadySent,
            eligible: reasons.length === 0,
            canSend: !isAlreadySent && reasons.length === 0,

            rejectionReasons: reasons,
          };
        });

        /* =====================================================
           7️⃣ SPLIT DATA
        ===================================================== */

        const alreadySentLenders = evaluatedLenders.filter(
          (l) => l.alreadySent,
        );

        const eligibleLenders = evaluatedLenders.filter(
          (l) => l.eligible && !l.alreadySent,
        );

        const rejectedLenders = evaluatedLenders.filter(
          (l) => !l.eligible && !l.alreadySent,
        );

        const allLenders = [
          ...eligibleLenders.map((l) => ({
            ...l,
            type: "eligible",
          })),

          ...rejectedLenders.map((l) => ({
            ...l,
            type: "rejected",
          })),

          ...alreadySentLenders.map((l) => ({
            ...l,
            type: "sent",
          })),
        ];

        const normalizedSearch = search.toLowerCase().trim();

        const filteredLenders = allLenders.filter((lender) => {
          const matchesSearch =
            lender.lenderName?.toLowerCase().includes(normalizedSearch) ||
            lender.loanProductCode?.toLowerCase().includes(normalizedSearch);

          const matchesFilter =
            filter === "all" ? true : lender.type === filter;

          return matchesSearch && matchesFilter;
        });

        const total = filteredLenders.length;

        const totalPages = Math.max(1, Math.ceil(total / limit));

        const paginatedLenders = filteredLenders.slice(
          (page - 1) * limit,
          page * limit,
        );

        const paginatedEligibleLenders = paginatedLenders.filter(
          (l) => l.type === "eligible",
        );

        const paginatedRejectedLenders = paginatedLenders.filter(
          (l) => l.type === "rejected",
        );

        const paginatedAlreadySentLenders = paginatedLenders.filter(
          (l) => l.type === "sent",
        );

        /* =====================================================
           8️⃣ RESPONSE
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
            totalAlreadySentLenders: alreadySentLenders.length,

            eligibleLenders: paginatedEligibleLenders,
            rejectedLenders: paginatedRejectedLenders,
            alreadySentLenders: paginatedAlreadySentLenders,

            pagination: {
              total,
              page,
              limit,
              totalPages,
              hasNextPage: page < totalPages,
              hasPrevPage: page > 1,
            },
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            submissionId,
            brokerOrgId: req.user?.organizationId,
          },
          "Eligibility evaluation failed",
        );

        return reply.code(500).send({
          success: false,
          message:
            error.message || "Internal server error while evaluating lenders",
        });
      }
    },
  );
};
