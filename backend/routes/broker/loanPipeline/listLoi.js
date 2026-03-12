/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function listLoiRoute(fastify) {

  fastify.get(
    "/:applicationId/lois",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Fetch LOIs received from lenders",
        params: {
          type: "object",
          required: ["applicationId"],
          properties: {
            applicationId: { type: "string" }
          }
        }
      }
    },

    async (req, reply) => {

      const prisma = fastify.prisma;

      try {

        /* ===============================
           AUTH CHECK
        =============================== */

        if (
          !req.user ||
          req.user.orgType !== "BROKER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { applicationId } = req.params;

        /* ===============================
           VERIFY APPLICATION OWNERSHIP
        =============================== */

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId
          }
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found"
          });
        }

        /* ===============================
           FETCH LOI RECORDS
        =============================== */

        const lenders = await prisma.applicationLender.findMany({
          where: {
            loanApplicationId: applicationId,
            loiUrl: { not: null }
          },
          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            lenderReviews: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        });

        if (!lenders.length) {
          return reply.send({
            success: true,
            message: "No LOI received yet",
            data: {
              applicationId,
              totalLoiReceived: 0,
              lois: []
            }
          });
        }

        /* ===============================
           FORMAT RESPONSE
        =============================== */

        const lois = lenders.map((l) => {

          const review = l.lenderReviews?.[0];

          return {
            applicationLenderId: l.id,
            lenderOrgId: l.lender?.id,
            lenderName: l.lender?.name,
            lenderEmail: l.lender?.email,
            lenderPhone: l.lender?.phone,
            status: l.status,
            loiUrl: l.loiUrl,
            approvedAmount: review?.approvedAmount ?? null,
            interestRate: review?.interestRate ?? null,
            notes: review?.notes ?? null,
            generatedAt: review?.createdAt ?? null
          };
        });

        return reply.send({
          success: true,
          data: {
            applicationId,
            totalLoiReceived: lois.length,
            lois
          }
        });

      } catch (error) {

        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch LOI data"
        });

      }

    }
  );
}

module.exports = listLoiRoute;