/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const fs = require("fs");
const path = require("path");

async function viewLoiBrokerRoute(fastify) {

  fastify.get(
    "/:applicationLenderId/view-loi",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "View LOI received from lender",
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
           FETCH RECORD
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
          return reply.code(404).send({
            success: false,
            message: "No LOI received from lender yet"
          });
        }

        const filePath = path.join(
          process.cwd(),
          "public",
          record.loiUrl
        );

        if (!fs.existsSync(filePath)) {
          return reply.code(404).send({
            success: false,
            message: "LOI file missing on server"
          });
        }

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

module.exports = viewLoiBrokerRoute;