/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function viewLoiRoute(fastify) {

  fastify.get(
    "/:applicationLenderId/view-loi",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Get generated LOI path",
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

        // =========================
        // AUTH CHECK
        // =========================

        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only"
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;

        // =========================
        // FETCH LOI RECORD
        // =========================

        const lenderRecord = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId
          },
          select: {
            loiUrl: true
          }
        });

        if (!lenderRecord) {
          return reply.code(404).send({
            success: false,
            message: "Application not found"
          });
        }

        if (!lenderRecord.loiUrl) {
          return reply.code(200).send({
            success: true,
            message: "LOI not generated yet",
            data: {
              loiPath: null
            }
          });
        }

        // =========================
        // RESPONSE
        // =========================

        return reply.send({
          success: true,
          data: {
            loiPath: lenderRecord.loiUrl
          }
        });

      } catch (error) {

        fastify.log.error(
          {
            error: error.message,
            applicationLenderId: req.params.applicationLenderId,
            lenderOrgId: req.user?.organizationId
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

module.exports = viewLoiRoute;