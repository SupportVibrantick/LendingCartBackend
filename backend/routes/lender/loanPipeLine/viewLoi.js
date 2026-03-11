/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const fs = require("fs");
const path = require("path");

async function viewLoiRoute(fastify) {

  fastify.get(
    "/:applicationLenderId/view-loi",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "View generated LOI",
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
        // FETCH APPLICATION
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
          return reply.code(404).send({
            success: false,
            message: "LOI not generated yet"
          });
        }

        // =========================
        // FILE PATH
        // =========================

        const filePath = path.join(
          process.cwd(),
          "public",
          lenderRecord.loiUrl
        );

        if (!fs.existsSync(filePath)) {
          return reply.code(404).send({
            success: false,
            message: "LOI file not found"
          });
        }

        // =========================
        // RETURN PDF
        // =========================

        reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", "inline")
          .send(fs.createReadStream(filePath));

      } catch (error) {

        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error"
        });

      }

    }
  );
}

module.exports = viewLoiRoute;