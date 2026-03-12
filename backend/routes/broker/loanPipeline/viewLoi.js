/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function viewLoiBrokerRoute(fastify) {

  fastify.get(
    "/:applicationLenderId/view-loi",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Get LOI path for broker",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" }
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
        const { applicationLenderId } = req.params;

        /* ===============================
           FETCH LOI RECORD
        =============================== */

        const record = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            loanApplication: {
              brokerOrgId
            }
          },
          select: {
            loiUrl: true
          }
        });

        if (!record) {
          return reply.code(404).send({
            success: false,
            message: "LOI record not found"
          });
        }

        if (!record.loiUrl) {
          return reply.code(200).send({
            success: true,
            message: "No LOI received yet",
            data: {
              loiPath: null
            }
          });
        }

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,
          data: {
            loiPath: record.loiUrl
          }
        });

      } catch (error) {

        fastify.log.error(
          {
            error: error.message,
            applicationLenderId: req.params.applicationLenderId,
            brokerOrgId: req.user?.organizationId
          },
          "Failed to fetch LOI"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error"
        });

      }

    }
  );
}

module.exports = viewLoiBrokerRoute;