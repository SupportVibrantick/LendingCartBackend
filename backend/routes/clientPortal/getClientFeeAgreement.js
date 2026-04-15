const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getClientFeeAgreement(fastify) {
  fastify.get(
    "/applications/:id/fee-agreement",
    {
      schema: {
        tags: ["Client → Fee Agreement"],
        summary: "Get Fee Agreement for client",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" }, // applicationId
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH
        =============================== */
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.code(401).send({
            ok: false,
            message: "Unauthorized",
          });
        }

        const token = authHeader.split(" ")[1];

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return reply.code(401).send({
            ok: false,
            message: "Invalid token",
          });
        }

        if (!decoded.clientId || decoded.role !== "CLIENT") {
          return reply.code(403).send({
            ok: false,
            message: "Access denied",
          });
        }

        const clientId = decoded.clientId;
        const applicationId = req.params.id;

        /* ===============================
           VERIFY APPLICATION OWNERSHIP
        =============================== */
        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            clientId,
          },
        });

        if (!application) {
          return reply.code(404).send({
            ok: false,
            message: "Application not found",
          });
        }

        /* ===============================
           FETCH FEE AGREEMENT
        =============================== */
        const feeAgreement = await prisma.feeAgreement.findUnique({
          where: {
            loanApplicationId: applicationId,
          },
        });

        if (!feeAgreement) {
          return reply.code(404).send({
            ok: false,
            message: "Fee Agreement not found",
          });
        }

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          ok: true,
          data: feeAgreement, // ✅ FULL OBJECT (no trimming)
        });

      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch fee agreement",
        });
      }
    }
  );
};