const generateAgreementHtml = require("./generateAgreementHtml");
const {
  getBrokerWhiteLabelBranding,
  lockAgreementBranding,
} = require("../../../../services/broker/brokerBranding");

module.exports = async function (fastify) {
  fastify.post(
    "/:id/fee-agreement/sign",
    {
      schema: {
        tags: ["Loan Pipeline → Fee Agreement"],
        summary: "Client signs Fee Agreement",
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
            signature: { type: "string" }, // base64 or file URL
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const { id } = req.params;
        const { signature } = req.body;

        // 🔐 AUTH CHECK
        if (!req.user) {
          return reply.code(401).send({
            ok: false,
            message: "Unauthorized",
          });
        }

        if (req.user.role !== "CLIENT_USER") {
          return reply.code(403).send({
            ok: false,
            message: "Only client can sign agreement",
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

        // ❌ Prevent re-signing
        if (agreement.status === "SIGNED") {
          return reply.code(400).send({
            ok: false,
            message: "Agreement already signed",
          });
        }

        // 🔐 Validate ownership (client belongs to this agreement)
        if (agreement.clientId !== req.user.clientId) {
          return reply.code(403).send({
            ok: false,
            message: "Access denied",
          });
        }

        const signedAt = new Date();
        const whiteLabelBranding = await getBrokerWhiteLabelBranding(
          prisma,
          agreement.brokerOrgId,
        );
        const lockedBranding = lockAgreementBranding(
          agreement,
          whiteLabelBranding,
        );

        // 🧠 Merge data + signature for HTML regeneration
        const updatedData = {
          ...agreement,
          ...lockedBranding,
          clientSignature: signature,
          signedAt: signedAt.toISOString(),
        };

        // 🧾 Regenerate HTML with signature
        const agreementHtml = generateAgreementHtml(updatedData);

        // 💾 Save signed agreement
        const signedAgreement = await prisma.feeAgreement.update({
          where: { id },
          data: {
            ...lockedBranding,
            clientSignature: signature,
            signedAt,
            status: "SIGNED",
            agreementHtml,
          },
        });

        return {
          ok: true,
          message: "Agreement signed successfully",
          data: signedAgreement,
        };
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