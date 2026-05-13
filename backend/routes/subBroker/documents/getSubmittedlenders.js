/**
 * @param {import("fastify").FastifyInstance} fastify
 */

module.exports = async function getSubmittedLendersForSubBroker(
  fastify,
) {
  fastify.get(
    "/:loanId/submitted-lenders",

    {
      preHandler: [
        fastify.authenticate,

        fastify.requireRole([
          "SUB_BROKER",
        ]),
      ],

      schema: {
        tags: [
          "Sub Broker → Loan Pipeline",
        ],

        summary:
          "Get submitted lenders for assigned loan",

        params: {
          type: "object",

          required: [
            "loanId",
          ],

          properties: {
            loanId: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma =
        fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK
        =============================== */

        if (!req.user) {
          return reply
            .code(401)
            .send({
              success: false,

              message:
                "Authentication required",
            });
        }

        const userId =
          req.user.userId;

        /* ===============================
           PARAM VALIDATION
        =============================== */

        let { loanId } =
          req.params;

        if (
          !loanId ||
          typeof loanId !==
            "string"
        ) {
          return reply
            .code(400)
            .send({
              success: false,

              message:
                "Invalid loanId",
            });
        }

        loanId = loanId
          .replace(/"/g, "")
          .trim();

        /* ===============================
           VERIFY ASSIGNED LOAN
        =============================== */

        const assignment =
          await prisma.subBrokerApplication.findFirst(
            {
              where: {
                loanApplicationId:
                  loanId,

                subBrokerId:
                  userId,
              },

              select: {
                id: true,
              },
            },
          );

        if (!assignment) {
          return reply
            .code(403)
            .send({
              success: false,

              message:
                "Access denied for this loan",
            });
        }

        /* ===============================
           FETCH SUBMITTED LENDERS
        =============================== */

        const applicationLenders =
          await prisma.applicationLender.findMany(
            {
              where: {
                loanApplicationId:
                  loanId,

                sentAt: {
                  not: null,
                },
              },

              include: {
                lender: {
                  select:
                    {
                      id: true,

                      name: true,

                      email:
                        true,

                      users:
                        {
                          select:
                            {
                              profileImage:
                                true,
                            },

                          take: 1,
                        },
                    },
                },

                lenderProduct:
                  {
                    select:
                      {
                        id: true,

                        loanProductCode:
                          true,
                      },
                  },
              },

              orderBy: {
                sentAt:
                  "desc",
              },
            },
          );

        /* ===============================
           HANDLE EMPTY CASE
        =============================== */

        if (
          !applicationLenders ||
          applicationLenders.length ===
            0
        ) {
          return reply.send({
            success: true,

            data: [],

            message:
              "No lenders submitted yet",
          });
        }

        /* ===============================
           FORMAT RESPONSE
        =============================== */

        const lenders =
          applicationLenders.map(
            (l) => ({
              applicationLenderId:
                l.id,

              lenderOrgId:
                l.lenderOrgId,

              lenderName:
                l.lender
                  ?.name ||
                null,

              lenderEmail:
                l.lender
                  ?.email ||
                null,

              profileImage:
                l.lender
                  ?.users?.[0]
                  ?.profileImage ||
                null,

              lenderProductId:
                l.lenderProductId,

              loanProductCode:
                l
                  .lenderProduct
                  ?.loanProductCode ||
                null,

              status:
                l.status,

              sentAt:
                l.sentAt,

              lastUpdatedAt:
                l.lastUpdatedAt,
            }),
          );

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          success: true,

          count:
            lenders.length,

          data: lenders,
        });
      } catch (error) {
        fastify.log.error(
          {
            error:
              error.message,

            stack:
              error.stack,

            loanId:
              req.params
                .loanId,

            user:
              req.user,
          },

          "❌ Sub broker submitted lenders fetch failed",
        );

        return reply
          .code(500)
          .send({
            success: false,

            message:
              error.message ||
              "Internal server error",
          });
      }
    },
  );
};