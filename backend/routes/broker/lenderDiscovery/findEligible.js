// broker/lenderDiscovery/findEligible.js

const {
  evaluateLenderProductEligibility,
  formatLenderInterestRate,
} = require("../../../utils/lender/evaluateLenderEligibility");
const {
  extractApplicantEligibilityData,
} = require("../../../utils/lender/extractApplicantEligibilityData");

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
            application: {
              include: {
                financials: true,
              },
            },
            fields: {
              include: {
                builderField: true,
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

        const roles = req.user.roles || [];
        if (roles.includes("BROKER_OFFICER")) {
          const userId = req.user.id || req.user.userId;
          if (application.brokerUserId !== userId) {
            return reply.code(403).send({
              success: false,
              message: "Access denied - not assigned to you",
            });
          }
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

        const applicantData = extractApplicantEligibilityData(
          submission,
          application,
        );

        const {
          loanAmount,
          termMonths,
          borrowerMinTerm,
          borrowerMaxTerm,
          creditScore,
          ltv,
          ltc,
          arv,
          dscr,
          debtYield,
          netWorth,
          interestRate,
          propertyType,
          propertyState,
          businessIndustry,
          yearsInBusiness,
          numberOfUnits,
          similarProjectsCompleted,
          portfolioPropertyCount,
          annualRevenue,
          isRefinance,
          ownerOccupied,
        } = applicantData;

        const applicant = {
          loanAmount,
          termMonths,
          creditScore,
          ltv,
          ltc,
          arv,
          dscr,
          debtYield,
          interestRate,
          propertyType,
          propertyState,
          businessIndustry,
          yearsInBusiness,
          numberOfUnits,
          similarProjectsCompleted,
          portfolioPropertyCount,
          annualRevenue,
          isRefinance,
          ownerOccupied,
        };

        const { loanProductCode } = application;

        /* =====================================================
           4️⃣ FETCH ALREADY SENT LENDERS
        ===================================================== */

        const applicationLenders = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: application.id,
          },
          select: {
            lenderProductId: true,
            status: true,
          },
        });

        const declinedStatuses = new Set(["DECLINED", "WITHDRAWN"]);

        const applicationStatusByProductId = new Map(
          applicationLenders
            .filter((entry) => entry.lenderProductId)
            .map((entry) => [entry.lenderProductId, entry.status]),
        );

        const sentProductIds = new Set(applicationStatusByProductId.keys());

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
              totalIneligibleLenders: 0,
              totalRejectedLenders: 0,
              totalAlreadySentLenders: 0,
              eligibleLenders: [],
              ineligibleLenders: [],
              rejectedLenders: [],
              alreadySentLenders: [],
            },
          });
        }

        /* =====================================================
           6️⃣ ELIGIBILITY EVALUATION
        ===================================================== */ 

        const evaluatedLenders = lenderProducts.map((lp) => {
          const applicationStatus =
            applicationStatusByProductId.get(lp.id) ?? null;
          const isAlreadySent = sentProductIds.has(lp.id);
          const isDeclined =
            isAlreadySent &&
            applicationStatus &&
            declinedStatuses.has(applicationStatus);
          const lender = lp.lender;
          const lenderProfile = lender.lenderProfile ?? null;

          const { reasons, minLoan, maxLoan } = evaluateLenderProductEligibility(
            lp,
            applicant,
            lenderProfile,
          );

          const isEligible = reasons.length === 0;

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
            interestRateRange: formatLenderInterestRate(lp),

            alreadySent: isAlreadySent,
            applicationStatus,
            isDeclined,
            eligible: isEligible,
            canSend: !isAlreadySent && isEligible,

            rejectionReasons: isDeclined ? [] : reasons,
          };
        });

        /* =====================================================
           7️⃣ SPLIT DATA
        ===================================================== */

        const eligibleLenders = evaluatedLenders.filter(
          (l) => l.eligible && !l.alreadySent,
        );

        const ineligibleLenders = evaluatedLenders.filter(
          (l) => !l.eligible && !l.alreadySent,
        );

        const rejectedLenders = evaluatedLenders.filter((l) => l.isDeclined);

        const alreadySentLenders = evaluatedLenders.filter(
          (l) => l.alreadySent && !l.isDeclined,
        );

        const allLenders = [
          ...eligibleLenders.map((l) => ({
            ...l,
            type: "eligible",
          })),

          ...ineligibleLenders.map((l) => ({
            ...l,
            type: "ineligible",
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

        const paginatedIneligibleLenders = paginatedLenders.filter(
          (l) => l.type === "ineligible",
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

              ltv,
              ltc,
              arv,

              dscr,
              netWorth,

              propertyType,
              propertyState,
              businessIndustry,
              yearsInBusiness,
              annualRevenue,
              isRefinance,
              ownerOccupied,
            },

            totalEligibleLenders: eligibleLenders.length,
            totalIneligibleLenders: ineligibleLenders.length,
            totalRejectedLenders: rejectedLenders.length,
            totalAlreadySentLenders: alreadySentLenders.length,

            eligibleLenders: paginatedEligibleLenders,
            ineligibleLenders: paginatedIneligibleLenders,
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
