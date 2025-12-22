const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  updateRuleSchema,
} = require("../../../schemas/lender/eligibility/update.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function updateRuleRoutes(fastify) {
  fastify.put("/:id", async (req, reply) => {
    try {
      // 🔐 Auth check
      if (
        !req.user ||
        req.user.orgType !== "LENDER" ||
        !req.user.organizationId
      ) {
        return reply.status(403).send({
          success: false,
          message: "Lender access only",
        });
      }

      // ✅ Zod validation
      const parsed = updateRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          message: "Invalid input",
          details: parsed.error.issues,
        });
      }

      // ✅ Fetch rule + ownership
      const rule = await prisma.eligibilityRule.findFirst({
        where: {
          id: req.params.id,
          ruleSet: {
            lenderProduct: {
              lenderOrgId: req.user.organizationId,
            },
          },
        },
      });

      if (!rule) {
        return reply.status(404).send({
          success: false,
          message: "Rule not found",
        });
      }

      const updated = await prisma.eligibilityRule.update({
        where: { id: req.params.id },
        data: parsed.data,
      });

      return reply.send({
        success: true,
        message: "Rule updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("UPDATE RULE ERROR:", err);
      return reply.status(500).send({
        success: false,
        message: "Server error while updating rule",
      });
    }
  });
};
