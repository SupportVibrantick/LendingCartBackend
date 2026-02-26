// routes/admin/lenders/hardDelete.js

const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * DEV ONLY - Permanent Hard Delete
 */
async function hardDeleteLenderRoutes(fastify) {
  fastify.delete(
    "/:lenderOrgId/hard",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "⚠️ HARD DELETE lender (DEV ONLY)",
        params: {
          type: "object",
          required: ["lenderOrgId"],
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { lenderOrgId } = request.params;

      try {
        const lender = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
          },
        });

        if (!lender) {
          return reply.status(404).send({
            success: false,
            message: "Lender not found.",
          });
        }

        await prisma.$transaction(async (tx) => {
          // 1️⃣ Lender Conditions
          await tx.lenderCondition.deleteMany({
            where: {
              lenderReview: {
                applicationLender: {
                  lenderOrgId,
                },
              },
            },
          });

          // 2️⃣ Lender Reviews
          await tx.lenderReview.deleteMany({
            where: {
              applicationLender: {
                lenderOrgId,
              },
            },
          });

          // 3️⃣ ApplicationLender
          await tx.applicationLender.deleteMany({
            where: { lenderOrgId },
          });

          // 4️⃣ Lender Document Requirements
          await tx.lenderDocumentRequirement.deleteMany({
            where: {
              lenderProduct: {
                lenderOrgId,
              },
            },
          });

          // 5️⃣ Eligibility Rules
          await tx.eligibilityRule.deleteMany({
            where: {
              ruleSet: {
                lenderProduct: {
                  lenderOrgId,
                },
              },
            },
          });

          // 6️⃣ Eligibility Rule Sets
          await tx.eligibilityRuleSet.deleteMany({
            where: {
              lenderProduct: {
                lenderOrgId,
              },
            },
          });

          // 7️⃣ Lender Products
          await tx.lenderProduct.deleteMany({
            where: { lenderOrgId },
          });

          // 8️⃣ Broker Access
          await tx.brokerLenderAccess.deleteMany({
            where: { lenderOrgId },
          });

          // 9️⃣ Broker Invites
          await tx.brokerLenderInvite.deleteMany({
            where: { lenderOrgId },
          });

          // 🔟 Escrow Title Companies
          await tx.escrowTitleCompany.deleteMany({
            where: { organizationId: lenderOrgId },
          });

          // 1️⃣1️⃣ User Roles
          await tx.userRole.deleteMany({
            where: {
              user: {
                organizationId: lenderOrgId,
              },
            },
          });

          // 1️⃣2️⃣ Users
          await tx.userAccount.deleteMany({
            where: { organizationId: lenderOrgId },
          });

          // 1️⃣3️⃣ Lender Profile
          await tx.lenderProfile.deleteMany({
            where: { lenderOrgId },
          });

          // 1️⃣4️⃣ Audit Logs (optional)
          await tx.auditLog.deleteMany({
            where: { actorOrgId: lenderOrgId },
          });

          // 1️⃣5️⃣ Finally delete Organization
          await tx.organization.delete({
            where: { id: lenderOrgId },
          });
        });

        adminLogs.warn("LENDER HARD DELETED (DEV)", { lenderOrgId });

        return reply.send({
          success: true,
          message: "Lender permanently deleted (DEV ONLY).",
        });
      } catch (error) {
        adminLogs.error("Hard delete failed", error);

        return reply.status(500).send({
          success: false,
          message: "Hard delete failed.",
          error: error.message,
        });
      }
    }
  );
}

module.exports = hardDeleteLenderRoutes;