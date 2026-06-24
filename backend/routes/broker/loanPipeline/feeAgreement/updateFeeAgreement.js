const generateAgreementHtml = require("./generateAgreementHtml");
const {
  getBrokerWhiteLabelBranding,
  buildBrandingSnapshot,
} = require("../../../../services/brokerBranding");
const {
  buildResolvedFeeAgreementContext,
} = require("../../../../services/refreshDraftFeeAgreement");
const {
  validateFeeAgreementTerms,
  normalizeFeeAgreementTerms,
} = require("../../../../services/feeAgreementEnrichment");

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

        const validationErrors = validateFeeAgreementTerms({
          brokerPoints,
          upfrontFee,
          exclusivityMonths,
        });

        if (validationErrors.length > 0) {
          return reply.code(400).send({
            ok: false,
            message: validationErrors.join(" "),
          });
        }

        const normalizedTerms = normalizeFeeAgreementTerms({
          brokerPoints,
          upfrontFee,
          exclusivityMonths,
        });

        // 🧠 Merge updated fields with existing snapshot
        const whiteLabelBranding = await getBrokerWhiteLabelBranding(
          prisma,
          agreement.brokerOrgId,
        );
        const brandingSnapshot = buildBrandingSnapshot(whiteLabelBranding);

        const loanApplication = await prisma.loanApplication.findUnique({
          where: { id: agreement.loanApplicationId },
          include: {
            brokerOrg: true,
            brokerUser: { include: { brokerProfile: true } },
            client: { include: { contacts: true } },
          },
        });

        const { merged: resolvedMerged } = await buildResolvedFeeAgreementContext(
          prisma,
          agreement,
          loanApplication,
        );

        const updatedData = {
          ...agreement,
          ...resolvedMerged,
          ...brandingSnapshot,

          brokerPoints:
            normalizedTerms.brokerPoints !== undefined
              ? normalizedTerms.brokerPoints
              : agreement.brokerPoints,

          upfrontFee:
            normalizedTerms.upfrontFee !== undefined
              ? normalizedTerms.upfrontFee
              : agreement.upfrontFee,

          exclusivityMonths:
            normalizedTerms.exclusivityMonths !== undefined
              ? normalizedTerms.exclusivityMonths
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
            brokerLogoUrl: brandingSnapshot.brokerLogoUrl,
            brokerBrandName: brandingSnapshot.brokerBrandName,
            clientAddress: updatedData.clientAddress,
            subjectAddress: updatedData.subjectAddress,
            brokerAddress: updatedData.brokerAddress,
            brokerState: updatedData.brokerState,
            brokerEmail: updatedData.brokerEmail,
            brokerPhone: updatedData.brokerPhone,
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
          message: err.message || "Failed to update Fee Agreement",
        });
      }
    }
  );
};