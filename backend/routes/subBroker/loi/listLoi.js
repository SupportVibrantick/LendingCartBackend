/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function subBrokerViewLoiRoute(fastify) {
  fastify.get(
    "/:applicationId/lois",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],

      schema: {
        tags: ["Sub Broker -> LOI"],

        summary: "Fetch LOIs for assigned application",

        params: {
          type: "object",

          required: ["applicationId"],

          properties: {
            applicationId: {
              type: "string",
            },
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

            message: "Unauthorized",
          });
        }

        const userId = req.user.userId;

        const { applicationId } = req.params;

        /* ===============================
           VERIFY ASSIGNED APPLICATION
        =============================== */

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            subBrokerId: userId,

            loanApplicationId: applicationId,
          },

          select: {
            id: true,

            loanApplicationId: true,
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,

            message: "Access denied. Application not assigned.",
          });
        }

        /* ===============================
           VERIFY APPLICATION EXISTS
        =============================== */

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
          },

          select: {
            id: true,

            applicationNumber: true,

            status: true,

            amountRequested: true,

            purpose: true,
          },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,

            message: "Application not found",
          });
        }

        /* ===============================
           FETCH LOI RECORDS
        =============================== */

        const lenders = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: applicationId,

            loiUrl: {
              not: null,
            },
          },

          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
              },
            },

            lenderReviews: {
              orderBy: {
                createdAt: "desc",
              },

              take: 1,
            },
          },

          orderBy: {
            sentAt: "desc",
          },
        });

        /* ===============================
           EMPTY RESPONSE
        =============================== */

        if (!lenders.length) {
          return reply.send({
            success: true,

            message: "No LOI received yet",

            data: {
              applicationId,

              applicationNumber: application.applicationNumber,

              totalLoiReceived: 0,

              lois: [],
            },
          });
        }

        /* ===============================
           FORMAT RESPONSE
        =============================== */

        const lois = lenders.map((l) => {
          const review = l.lenderReviews?.[0];

          return {
            applicationLenderId: l.id,

            loanApplicationId: l.loanApplicationId,

            lenderOrgId: l.lender?.id,

            lenderName: l.lender?.name || "N/A",

            lenderEmail: l.lender?.email || "N/A",

            lenderPhone: l.lender?.phone || "N/A",

            lenderStatus: l.lender?.status || "N/A",

            status: l.status,

            loiUrl: l.loiUrl,

            approvedAmount: review?.approvedAmount ?? null,

            interestRate: review?.interestRate ?? null,

            notes: review?.notes ?? null,

            generatedAt: review?.createdAt ?? null,

            reviewedBy: review?.reviewedById ?? null,

            createdAt: l.createdAt,

            updatedAt: l.updatedAt,
          };
        });

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          success: true,

          data: {
            applicationId,

            applicationNumber: application.applicationNumber,

            applicationStatus: application.status,

            amountRequested: application.amountRequested || 0,

            purpose: application.purpose || "N/A",

            totalLoiReceived: lois.length,

            lois,
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,

          message: error.message || "Failed to fetch LOI data",
        });
      }
    },
  );
}

module.exports = subBrokerViewLoiRoute;
