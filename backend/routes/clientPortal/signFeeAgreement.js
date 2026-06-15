/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function signFeeAgreement(fastify) {
  const jwt = require("jsonwebtoken"); // ✅ REQUIRED

  fastify.post(
    "/:id/fee-agreement/sign",
    {
      schema: {
        tags: ["Fee Agreement"],
        summary: "Client signs fee agreement",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["signature"],
          properties: {
            signature: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH (FIXED ✅)
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
          decoded = jwt.verify(token, process.env.JWT_SECRET); // ✅ FIXED
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
        const { signature } = req.body;

        /* ===============================
           VALIDATION
        =============================== */
        if (!signature || signature.trim() === "") {
          return reply.code(400).send({
            ok: false,
            message: "Signature is required",
          });
        }

        /* ===============================
           VERIFY APPLICATION
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
           FETCH AGREEMENT
        =============================== */
        const agreement = await prisma.feeAgreement.findFirst({
          where: {
            loanApplicationId: applicationId,
          },
        });

        if (!agreement) {
          return reply.code(404).send({
            ok: false,
            message: "Fee Agreement not found",
          });
        }

        if (agreement.status === "SIGNED") {
          return reply.code(400).send({
            ok: false,
            message: "Already signed",
          });
        }

        const { canClientSignFeeAgreement } = require("../../services/feeAgreementEnrichment");

        if (!canClientSignFeeAgreement(agreement)) {
          return reply.code(400).send({
            ok: false,
            message:
              "Fee terms are not finalized yet. Your broker must set broker fee, upfront fee, and exclusivity period before you can sign.",
          });
        }

        /* ===============================
           UPDATE
        =============================== */
        const updated = await prisma.feeAgreement.update({
          where: { id: agreement.id },
          data: {
            clientSignature: signature,
            signedAt: new Date(),
            status: "SIGNED",
          },
        });

        return reply.send({
          ok: true,
          message: "Agreement signed successfully",
          data: updated,
        });
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          ok: false,
          message: "Failed to sign agreement",
        });
      }
    }
  );
};