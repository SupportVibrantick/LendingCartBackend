const generateAgreementHtml = require("./generateAgreementHtml");

module.exports = async function (fastify) {
  fastify.patch(
    "/:id/fee-agreement",
    {
      schema: {
        tags: ["Loan Pipeline → Fee Agreement"],
        summary: "Update Fee Agreement (Broker only)",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            brokerPoints: { type: "number" },
            upfrontFee: { type: "number" },
            exclusivityMonths: { type: "number" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const { id } = req.params;
        const { brokerPoints, upfrontFee, exclusivityMonths } = req.body;

        // 🔐 AUTH CHECK
        if (!req.user) {
          return reply.code(401).send({
            ok: false,
            message: "Unauthorized",
          });
        }

        if (
          req.user.orgType !== "BROKER" &&
          req.user.role !== "PLATFORM_ADMIN"
        ) {
          return reply.code(403).send({
            ok: false,
            message: "Only broker/admin can update agreement",
          });
        }

        // 📥 Fetch agreement
        const agreement = await prisma.feeAgreement.findUnique({
          where: { id },
        });

        if (!agreement) {
          return reply.code(404).send({
            ok: false,
            message: "Fee Agreement not found",
          });
        }

        // ❌ Prevent edit if signed
        if (agreement.status === "SIGNED") {
          return reply.code(400).send({
            ok: false,
            message: "Cannot edit signed agreement",
          });
        }

        // 🧠 Merge updated fields with existing snapshot
        const updatedData = {
          ...agreement,

          brokerPoints:
            brokerPoints !== undefined
              ? brokerPoints
              : agreement.brokerPoints,

          upfrontFee:
            upfrontFee !== undefined
              ? upfrontFee
              : agreement.upfrontFee,

          exclusivityMonths:
            exclusivityMonths !== undefined
              ? exclusivityMonths
              : agreement.exclusivityMonths,
        };

        // 🧾 Regenerate HTML
        const agreementHtml = generateAgreementHtml(updatedData);

        // 💾 Update DB
        const updatedAgreement = await prisma.feeAgreement.update({
          where: { id },
          data: {
            brokerPoints: updatedData.brokerPoints,
            upfrontFee: updatedData.upfrontFee,
            exclusivityMonths: updatedData.exclusivityMonths,
            agreementHtml,
          },
        });

        return {
          ok: true,
          message: "Fee Agreement updated successfully",
          data: updatedAgreement,
        };
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          ok: false,
          message: "Failed to update Fee Agreement",
        });
      }
    }
  );
};