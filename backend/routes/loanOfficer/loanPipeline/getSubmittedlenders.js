/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getSubmittedLenders(fastify) {
  fastify.get(
    "/:loanId/submitted-lenders",
    {
      schema: {
        tags: ["Loan Pipeline"],
        summary: "Get submitted lenders for a loan (Broker only)",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK
        =============================== */
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (
          !req.user.organizationId ||
          req.user.orgType !== "BROKER"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* ===============================
           PARAM VALIDATION
        =============================== */
        let { loanId } = req.params;

        if (!loanId || typeof loanId !== "string") {
          return reply.code(400).send({
            success: false,
            message: "Invalid loanId",
          });
        }

        loanId = loanId.replace(/"/g, "").trim();

        /* ===============================
           VERIFY LOAN OWNERSHIP
        =============================== */
        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanId },
          select: {
            id: true,
            brokerOrgId: true,
            brokerUserId: true,
          },
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

        const userId = req.user.id || req.user.userId;
        if (loan.brokerUserId !== userId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied - not assigned to you",
          });
        }

        /* ===============================
           FETCH SUBMITTED LENDERS
        =============================== */
        const applicationLenders = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: loanId,
            sentAt: {
              not: null, // ✅ only submitted
            },
          },
          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                users: {
                  select: {
                    profileImage: true,
                  },
                  take: 1,
                },
              },
            },
            lenderProduct: {
              select: {
                id: true,
                loanProductCode: true,
              },
            },
          },
          orderBy: {
            sentAt: "desc",
          },
        });

        /* ===============================
           HANDLE EMPTY CASE
        =============================== */
        if (!applicationLenders || applicationLenders.length === 0) {
          return reply.send({
            success: true,
            data: [],
            message: "No lenders submitted yet",
          });
        }

        /* ===============================
           FORMAT RESPONSE
        =============================== */
        const lenders = applicationLenders.map((l) => ({
          applicationLenderId: l.id,
          lenderOrgId: l.lenderOrgId,

          lenderName: l.lender?.name || null,
          lenderEmail: l.lender?.email || null,
          profileImage: l.lender?.users?.[0]?.profileImage || null,

          lenderProductId: l.lenderProductId,
          loanProductCode: l.lenderProduct?.loanProductCode || null,

          status: l.status,
          sentAt: l.sentAt,
          lastUpdatedAt: l.lastUpdatedAt,
        }));

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.send({
          success: true,
          count: lenders.length,
          data: lenders,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            loanId: req.params.loanId,
            user: req.user,
          },
          "❌ Fetch submitted lenders failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};